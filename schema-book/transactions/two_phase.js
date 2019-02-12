var db = db.getSisterDB("bank");
db.dropDatabase();
var accounts = db.accounts;
var transactions = db.transactions;

accounts.insertOne({ _id: 1, name: "Joe Moneylender", balance: 1000, pendingTransactions:[] });
accounts.insertOne({ _id: 2, name: "Peter Bum", balance: 1000, pendingTransactions:[] });

function cancel(id) {
  transactions.updateOne(
    { _id: id }, 
    { $set: { state: "canceled" } }
  );
}

function rollback(from, to, amount, id) {
  // Reverse debit
  accounts.updateOne({
      name: from, 
      pendingTransactions: { $in: [id] }
    }, {
      $inc: { balance: amount }, 
      $pull: { pendingTransactions: id }
    });  

  // Reverse credit
  accounts.updateOne({
    name: to, 
    pendingTransactions: { $in: [id] }
  }, {
    $inc: { balance: -amount }, 
    $pull: { pendingTransactions: id }
  });  

  cancel(id);
}

function cleanup(from, to, id) {
  // Remove the transaction ids
  accounts.updateOne(
    { name: from }, 
    { $pull: { pendingTransactions: id } });
  
  // Remove the transaction ids
  accounts.updateOne(
    { name: to }, 
    { $pull: { pendingTransactions: id } });

  // Update transaction to committed
  transactions.updateOne(
    { _id: id }, 
    { $set: { state: "done" } });
}

function executeTransaction(from, to, amount) {
  var transactionId = ObjectId();

  transactions.insert({
    _id: transactionId, 
    source: from, 
    destination: to, 
    amount: amount, 
    state: "initial"
  });

  var result = transactions.updateOne(
    { _id: transactionId }, 
    { $set: { state: "pending" } }
  );

  if (result.modifiedCount == 0) {
    cancel(transactionId);
    throw Error("Failed to move transaction " + transactionId + " to pending");
  }

  // Set up pending debit
  result = accounts.updateOne({
    name: from, 
    pendingTransactions: { $ne: transactionId }, 
    balance: { $gte: amount }
  }, {
    $inc: { balance: -amount }, 
    $push: { pendingTransactions: transactionId }
  });

  if (result.modifiedCount == 0) {
    rollback(from, to, amount, transactionId);
    throw Error("Failed to debit " + from + " account");
  }

  // Setup pending credit
  result = accounts.updateOne({
    name: to, 
    pendingTransactions: { $ne: transactionId }
  }, {
    $inc: { balance: amount }, 
    $push: { pendingTransactions: transactionId }
  });

  if (result.modifiedCount == 0) {
    rollback(from, to, amount, transactionId);
    throw Error("Failed to credit " + to + " account");
  }

  // Update transaction to committed
  result = transactions.updateOne(
    { _id: transactionId }, 
    { $set: { state: "committed" } }
  );

  if (result.modifiedCount == 0) {
    rollback(from, to, amount, transactionId);
    throw Error("Failed to move transaction " + transactionId + " to committed");
  }

  // Attempt cleanup
  cleanup(from, to, transactionId);
}

executeTransaction("Joe Moneylender", "Peter Bum", 100);