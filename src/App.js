import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";

import "./App.css";

// Make sure to call loadStripe outside of a component’s render to avoid
// recreating the Stripe object on every render.
// loadStripe is initialized with a fake API key.
const stripePromise = loadStripe("pk_test_51JyvgOANb0LBpbzQdwhtXiFJy3W2y2ZWlwqpAZ5pxfumCaRxAe8pRxo9ntXisr8k9wJrbG1lSujUWEBhEvvPAavR00JWwmVqv5");

export default function App() {
  // const [clientSecret, setClientSecret] = useState("");
  const [errorPage, setErrorPage] = useState(false);
  const [amount, setAmount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  return (
    <div className="App">
      {/* <form id="payment-form" onSubmit={handleSubmit}> */}
      <form id="payment-form" action="/create-checkout-session" method="POST">
        <label for="amount">Enter amount here: $</label>
        <input name="amount" type="number" onInput={e => { setAmount(e.target.value)}} value={amount}></input>
        <button id="submit" disabled={amount < 0.5 || isLoading}>
          <span id="button-text">
            {isLoading ? <div className="spinner" id="spinner"></div> : "Pay $" + amount + " now"}
          </span>
        </button>
      </form>
      {/* {clientSecret && (
        <Elements options={options} stripe={stripePromise}>
          <CheckoutForm />
        </Elements>
      )} */}
      {errorPage && (
        "Something went wrong"
      )}
    </div>
  );
}