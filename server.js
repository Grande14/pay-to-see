const express = require("express");
const app = express();
const expirationSeconds = 3600;

var AWS = require("aws-sdk");
AWS.config.update({
  region: "us-west-1"
});
var tableName = "pay-to-see-db";
var docClient = new AWS.DynamoDB.DocumentClient();

// function something() {
//   var params = {
//       TableName:tableName,
//       Item:{
//           "partitionkey": "some_id_lol",
//           "ttl": Math.floor(Date.now() / 1000) + TTL_seconds,
//           "sample": "hello"
//       }
//   };

//   console.log("Adding a new item...");
//   docClient.put(params, function(err, data) {
//       if (err) {
//           console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
//       } else {
//           console.log("Added item:", JSON.stringify(data, null, 2));
//       }
//   });
// }
// something();

// function readTable() {
//   var params = {
//       TableName: tableName,
//       Key:{
//           "partitionkey": "some_id_lol",
//       }
//   };
  
//   docClient.get(params, function(err, data) {
//       if (err) {
//           console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
//       } else {
//           if (data.Item && data.Item.ttl >=  Math.floor(Date.now() / 1000)) {
//             console.log("Got not expired data: " + JSON.stringify(data.Item, null, 2))
//           } else {
//             console.log("Got EXPIRED: " + JSON.stringify(data.Item, null, 2));
//           }
//       }
//   });
// }
// readTable();

require('dotenv').config({ path: './.env' });

// This is a sample test API key.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded()); // to support URL-encoded bodies

app.post('/create-checkout-session', async (req, res, next) => {
  console.log(req.body);
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'pay-to-see-amount',
          },
          unit_amount: Math.floor(parseFloat(req.body.amount) * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: 'http://localhost:3000?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'http://localhost:3000',
    // expires_at: Math.floor(Date.now() / 1000) + expirationSeconds,
  }).catch((err) => {
    console.log("caught error in create checkout session: " + err);
  })

  if (!session) {
    return next();
  }

  res.redirect(303, session.url);
});

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

  // res.json({ data: 10005 });
});

app.listen(4242, () => console.log("Node server listening on port 4242!"));