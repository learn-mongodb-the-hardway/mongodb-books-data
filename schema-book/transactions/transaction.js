var db = db.getSisterDB("bank");
var session = db.getMongo().startSession();
var accounts = session.getDatabase("bank").accounts;
var transactions = session.getDatabase("bank").transactions;

// Retries a transaction commit
function retryUnknownTransactionCommit(session) {
  while(true) {
    try {
      // Attempt to commit the transaction
      session.commitTransaction();
      break;
    } catch (err) {
      if (err.errorLabels != null 
        && err.errorLabels.includes("UnknownTransactionCommitResult")) {
          // Keep retrying the transaction
          continue;
        }

      // The transaction cannot be retried, 
      // return the exception
      return err;
    }
  }
}

function executeTransaction(session, from, to, amount) {
  while (true) {
    try {
      // Start a transaction on the current session
      session.startTransaction({ 
        readConcern: { level: "snapshot" }, writeConcern: { w: "local" } 
      });

      // Debit the `from` account
      var result = accounts.updateOne(
        { name: from, amount: { $gte: amount } }, 
        { $inc: { amount: -amount } });

      // If we could not debit the account, abort the
      // transaction and throw an exception
      if (result.modifiedCount == 0) {
        session.abortTransaction();
        throw Error("failed to debit the account [" + from + "]");
      }

      // Credit the `from` account
      result = accounts.updateOne(
        { name: to }, 
        { $inc: { amount: amount } });

      // If we could not credit the account, abort the
      // transaction and throw an exception
      if (result.modifiedCount == 0) {
        session.abortTransaction();
        throw Error("failed to credit the account [" + to + "]");
      }

      // Insert a record of the transaction
      transactions.insertOne(
        { from: from, to: to, amount: amount, on: new Date() });

      // Attempt to commit the transaction
      session.commitTransaction();
      // Transaction was committed successfully break the while loop
      break;
    } catch (err) {
      // If we have no error labels rethrow the error
      if (err.errorLabels == null) {
        throw err;
      }

      // Error labels include TransientTransactionError label
      // Start while loop again, creating a new transaction
      if (err.errorLabels.includes("TransientTransactionError")) {
        continue;
      }

      // Our error has error labels and contains the UnknownTransactionCommitResult label
      if (err.errorLabels.includes("UnknownTransactionCommitResult")) {
        // Retry the transaction commit
        var exception = retryUnknownTransactionCommit(session, err);
        // No error, commit as successful, break the while loop
        if (exception == null) break;
        // Error has no errorLabels, rethrow the error
        if (exception.errorLabels == null) throw exception;

        // Error labels include TransientTransactionError label
        // Start while loop again, creating a new transaction
        if (err.errorLabels.includes("TransientTransactionError")) {
          continue;
        }
        
        // Rethrow the error
        throw exception;
      }

      // Rethrow the error
      throw err;
    }
  }
}  

executeTransaction(session, "Peter", "Joe", 100);
