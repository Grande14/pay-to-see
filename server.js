const express = require("express");
const app = express();

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
    success_url: 'http://localhost:3000',
    cancel_url: 'http://localhost:3000',
  }).catch((err) => {
    console.log("caught error in create checkout session: " + err);
  })

  if (!session) {
    return next();
  }

  res.redirect(303, session.url);
});

app.listen(4242, () => console.log("Node server listening on port 4242!"));