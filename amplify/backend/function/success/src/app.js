/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_PAYTOSEEDB_ARN
	STORAGE_PAYTOSEEDB_NAME
	STORAGE_PAYTOSEEDB_STREAMARN
Amplify Params - DO NOT EDIT *//*
Copyright 2017 - 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
*/




var express = require('express')
var bodyParser = require('body-parser')
var awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
const expirationSeconds = 3600;

var AWS = require("aws-sdk");
AWS.config.update({
  region: process.env.REGION
});
var tableName = process.env.STORAGE_PAYTOSEEDB_NAME;
var docClient = new AWS.DynamoDB.DocumentClient();

require('dotenv').config({ path: './.env' });
// This is a sample test API key.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// declare a new express app
var app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())
app.use(express.urlencoded()); // to support URL-encoded bodies

// Enable CORS for all methods
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "*")
  next()
});


/**********************
 * Example get method *
 **********************/

var totalNumberPayedParams = {
  TableName: tableName,
  Key:{
      "partitionkey": "totalNumberPayed",
  }
};
var totalAmountPayedParams = {
  TableName: tableName,
  Key:{
      "partitionkey": "totalAmountPayed",
  }
};

app.get('/success', async (req, res, next) => {
  const session = await stripe.checkout.sessions.retrieve(req.query.session_id)
  .catch((err) => {
    console.log("Caught error");
  });
  if (!session) {
    console.log("Session is undefined");
    return res.status(500).send("Looks like you haven't paid yet!")
  }
  if (session.payment_status != 'paid') {
    console.log("Unpaid session!");
    return res.status(500).send("Looks like you haven't paid yet!")
  }
  // TODO: get data from db here
  console.log("User paid amount: " + session.amount_total);

  // Get the payment intent
  const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
  if (!paymentIntent) {
    console.log("Payment intent is undefined");
    return res.status(500).send("Looks like you haven't paid yet!")
  }
  // Check trying to use payment past the expiration
  if (paymentIntent.created + expirationSeconds < Math.floor(Date.now() / 1000)) {
    console.log("Payment past expiration");
    return res.status(500).send("Your session has expired, you must pay again to view! Thank you for your cooperation")
  }

  var sessionParams = {
      TableName: tableName,
      Key:{
          "partitionkey": req.query.session_id,
      }
  };

  docClient.get(sessionParams, async function(err, data) {
      if (err) {
          console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
          return next();
      } else {
        // Check if session already exist
        if (data.Item && data.Item.partitionkey) {
          console.log("item already exists");
          res.json({
            data: {
              average: data.Item.average,
              totalNumberPayed: data.Item.totalNumberPayed,
              sessionAmount: session.amount_total
            }
          })
        } else {
          console.log("Creating item since NOT exist");
          // Get the total number and average
          const totalNumber = await docClient.get(totalNumberPayedParams).promise().catch((err) => {
            console.log("caught error in getting item: " + err);
            return next();
          });

          const totalAmount = await docClient.get(totalAmountPayedParams).promise().catch((err) => {
            console.log("caught error in getting item: " + err);
            return next();
          });

          if (totalNumber.Item == undefined || totalAmount.Item == undefined) {
            console.error("total number or total amount Items are undefined");
            return next();
          }

          // Increment total number and total amount
          var totalNumberIncrementParams = {
              TableName:tableName,
              Key:{
                "partitionkey": "totalNumberPayed",
              },
              UpdateExpression: "set valueNumber = valueNumber + :val",
              ExpressionAttributeValues:{
                  ":val": 1
              },
              ReturnValues:"UPDATED_NEW"
          };
          docClient.update(totalNumberIncrementParams, function(err, data) {
              if (err) {
                  console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
                  return next();
              } else {
                  console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
              }
          });
          var totalAmountIncrementParams = {
              TableName:tableName,
              Key:{
                "partitionkey": "totalAmountPayed",
              },
              UpdateExpression: "set valueNumber = valueNumber + :val",
              ExpressionAttributeValues:{
                  ":val": session.amount_total
              },
              ReturnValues:"UPDATED_NEW"
          };
          docClient.update(totalAmountIncrementParams, function(err, data) {
              if (err) {
                  console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
                  return next();
              } else {
                  console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
              }
          });

          // Add the record for this session
          const averagePayment = (totalAmount.Item.valueNumber / 100.) / totalNumber.Item.valueNumber;
          console.log("total amount: " + totalAmount.Item.valueNumber);
          console.log("total number: " + totalNumber.Item.valueNumber);
          console.log("average payment: " + averagePayment);
          var addSessionParams = {
              TableName:tableName,
              Item:{
                "partitionkey": req.query.session_id,
                "ttl": Math.floor(Date.now() / 1000) + expirationSeconds,
                "totalNumberPayed": totalNumber.Item.valueNumber,
                "average": averagePayment,
              }
          };
          docClient.put(addSessionParams, function(err, data) {
              if (err) {
                  console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
                  return next();
              } else {
                  console.log("Added session item:", JSON.stringify(data, null, 2));
              }
          });

          // return the response
          res.json({
            data: {
              average: averagePayment,
              totalNumberPayed: totalNumber.Item.valueNumber,
              sessionAmount: session.amount_total
            }
          })
        }
      }
  });

});

app.listen(3000, function() {
    console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
