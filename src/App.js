import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import Amplify, { API } from 'aws-amplify';
import awsconfig from './aws-exports';

import "./App.css";

Amplify.configure(awsconfig);

// Make sure to call loadStripe outside of a component’s render to avoid
// recreating the Stripe object on every render.
// loadStripe is initialized with a fake API key.
const stripePromise = loadStripe("pk_live_51JyvgOANb0LBpbzQ1n2Suh7fnNCJsXjCrP76pv5alkhhwyFba81XDcy6xu3ylrY1jGRhMauq2kFgvTTQjOadgMDd00LySKFhpV");

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
    return API.get('nodeapi', '/success', {
      queryStringParameters: {
        'session_id': session_id
      }
    })
    .then(response => {
      // Add your code here
      console.log("got data")
      console.log(response);
      setStatData(response);
    })
    .catch(error => {
      console.log(error.response);
      setErrorPage(error.response.data);
   });
  }, []);

  // TODO: use cors redirect if want to call here
  async function handleFormSubmit(event) {
    event.preventDefault();
    return await API.post('nodeapi', '/create-checkout-session', {
      body: {
        amount: amount
      }
    });
  }

  return (
    <div className="App" style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
      <div className="title">
        <b>Pay to See</b>
      </div>
      {/* <form id="payment-form" onSubmit={handleSubmit}> */}
      {statData.data == '' ?
        <div style={{paddingLeft: '20%', paddingRight: '20%'}}>
          <b>{"Pay to see how much others across the world have paid to see how much others have paid to see... you get the idea."}</b>
        </div>
      : 
      <div>
        <div> {"On average, people paid: $" + Math.floor(statData.data.average * 100) / 100.}
        </div>
        <div> {"You paid $" + statData.data.sessionAmount / 100. + (Math.floor(statData.data.average * 100) / 100. > statData.data.sessionAmount / 100 ? ". A little greedy, eh?" : ". Thanks for being a generous human being!")}
        </div>
        <div> {statData.data.totalNumberPayed + " people across the world have participated!"}
        </div>
      </div>
      }
      <br></br>
      {/* <form id="payment-form" onSubmit={handleFormSubmit}> */}
      <form id="payment-form" action="https://tuui63hhf5.execute-api.us-west-1.amazonaws.com/dev/create-checkout-session" method="POST">
        <label for="amount">Enter amount here: $</label>
        <input name="amount" type="number" onInput={e => { setAmount(e.target.value)}} value={amount}></input>
        <button style ={{marginTop: 20}} id="submit" disabled={amount < 0.5}>
          <span id="button-text">
            {/* {isLoading ? <div className="spinner" id="spinner"></div> : "Pay $" + amount + " now"} */}
            {"Pay $" + amount + " now"}
          </span>
        </button>
      </form>
      <br></br>
      {errorPage.length != 0 ? (
        errorPage
      ) : ""}
    </div>
  );
}