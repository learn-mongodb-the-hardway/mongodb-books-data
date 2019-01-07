# Geo-Spatial Chapter

## Pre-requisites

- MongoDB running on port 27017
- `mongo` and `mongorestore` available in the command line `path`
- Basic command line knowledge

## Load the data

To load the data we are going to use the `mongorestore` tool that comes with MongoDB. `Mongorestore` allows us to consume line separated `json` as well as `extended json` documents and import them into MongoDB. Open your command line and navigate to the location of the file [pubs_dump.json](./pubs_dump.json).

```txt
> mongorestore /d schema-book-geo /c pubs pubs_dump.json
```

The output of executing the command should look something like.

```
2019-01-07T16:29:54.908+0100    connected to: localhost
2019-01-07T16:29:54.935+0100    imported 38 documents
```

That should have created the expected documents in our database `schema-book-geo` and collection `pubs`.

## Create the Geo-Spatial Index

Next we have to create the `Geo-Spatial` index so we can query for our documents. Start up the `mongo` shell.

```txt
> mongo
```

Next change the database to `schema-book-geo`.

```js
> use schema-book
```

Let's create the `Geo-Spatial` index on the `pubs` collection.

```js
> db.pubs.createIndex({ geometry: "2dsphere" });
```

If everything went well you should be able to see the following output from executing the `createIndex` command.

```js
{
        "createdCollectionAutomatically" : false,
        "numIndexesBefore" : 1,
        "numIndexesAfter" : 2,
        "ok" : 1
}
```

The test data is now set up  to be able to be used.