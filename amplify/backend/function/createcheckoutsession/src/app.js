/*
Copyright 2017 - 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
*/




var express = require('express')
var bodyParser = require('body-parser')
var awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')

require('dotenv').config({ path: './.env' });
// This is a sample test API key.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const HOST = "pay-to-see.com"

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

/****************************
* Example post method *
****************************/

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
    success_url: `http://${HOST}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `http://${HOST}`,
    // expires_at: Math.floor(Date.now() / 1000) + expirationSeconds,
  }).catch((err) => {
    console.log("caught error in create checkout session: " + err);
  })

  if (!session) {
    return next();
  }

  res.redirect(303, session.url);
});

app.listen(3000, function() {
    console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
