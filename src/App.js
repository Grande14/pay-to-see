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
  const [errorPage, setErrorPage] = useState("");
  const [amount, setAmount] = useState(1);
  const [statData, setStatData] = useState({data: ''});
  
  useEffect(() => {
    const session_id = new URLSearchParams(window.location.search).get(
      "session_id"
    );

    if (!session_id) {
      return;
    }
    console.log("Got session id: " + session_id);
    // Fetch data from server
    fetch("/success?session_id=" + session_id, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
    .then(async (res) => {
      if (res.ok) {
        return res.json();
      } else {
        const errorText = await res.text();
        throw new Error(errorText);
      }
    })
    .then((data) => {
      console.log(data);
      setStatData(data);
    })
    .catch((err) => {
      console.log(err.message)
      setErrorPage(err.message);
    })
  }, []);

  return (
    <div className="App">
      {/* <form id="payment-form" onSubmit={handleSubmit}> */}
      {statData.data == '' ? "Pay to see here!" : 
      <div>
        <div> {"On average, people paid: $" + Math.floor(statData.data.average * 100) / 100.}
        </div>
        <div> {"You paid $" + statData.data.sessionAmount / 100. + (Math.floor(statData.data.average * 100) / 100. > statData.data.sessionAmount / 100 ? ". A little greedy, eh?" : ". Thanks for being a generous human being!")}
        </div>
        <div> {statData.data.totalNumberPayed + " people across the world have participated!"}
        </div>
      </div>
      }
      <form id="payment-form" action="/create-checkout-session" method="POST">
        <label for="amount">Enter amount here: $</label>
        <input name="amount" type="number" onInput={e => { setAmount(e.target.value)}} value={amount}></input>
        <button id="submit" disabled={amount < 0.5}>
          <span id="button-text">
            {/* {isLoading ? <div className="spinner" id="spinner"></div> : "Pay $" + amount + " now"} */}
            {"Pay $" + amount + " now"}
          </span>
        </button>
      </form>
      {errorPage.length != 0 ? (
        errorPage
      ) : ""}
    </div>
  );
}