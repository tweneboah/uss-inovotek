require("dotenv").config();
const express = require("express");
const cache = require("memory-cache");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: false,
  })
);

app.use(cors());
app.options("*", cors());

app.get("/", (req, res) => res.status(200).send("Arkesel Rocks!!"));

app.post("/", (req, res) => {
  const { sessionID, userID, newSession, msisdn, userData, network } = req.body;
  if (newSession) {
    const message =
      "Welcome to Easy Vote GH. Please vote for your favourite service from Easy Vote GH" +
      "\n1. Vote" +
      "\n2. Cancel";
    const continueSession = true;

    // Keep track of the USSD state of the user and their session
    const currentState = {
      sessionID,
      msisdn,
      userData,
      network,
      newSession,
      message,
      level: 1,
      page: 1,
    };

    let userResponseTracker = cache.get(sessionID);
    !userResponseTracker
      ? (userResponseTracker = [{ ...currentState }])
      : userResponseTracker.push({ ...currentState });

    cache.put(sessionID, userResponseTracker);
    res.setHeader("Content-Type", "application/json");
    // rendering first screen
    return res.status(200).json({
      userID,
      sessionID,
      message,
      continueSession,
      msisdn,
    });
  }

  const userResponseTracker = cache.get(sessionID);

  if (!userResponseTracker) {
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json({
      userID,
      sessionID,
      message: "Error! Please dial code again!",
      continueSession: false,
      msisdn,
    });
  }

  // start new rendering  screen by selecting option
  const lastResponse = userResponseTracker[userResponseTracker.length - 1];

  let message = "Bad Option";
  let continueSession = false;

  if (lastResponse.level === 1) {
    if (["2"].includes(userData)) {
      message = "Application quit";
      continueSession = false;
    }

    if (userData === "1") {
      message = "Enter your contestant's code ";
      continueSession = true;

      const currentState = {
        sessionID,
        userID,
        level: 2,
        msisdn,
        message,
        userData,
        network,
        newSession,
        page: 1,
      };

      userResponseTracker.push({ ...currentState });
      cache.put(sessionID, userResponseTracker);

      //find the user in the db

      //get user entered data
      //get the contestant's code
      //check if the contestant's code is valid
    }
  } else if (lastResponse.level === 2) {
    const currentState = {
      sessionID,
      userID,
      level: 3,
      msisdn,
      message,
      userData,
      network,
      newSession,
      page: 3,
    };

    userResponseTracker.push({ ...currentState });
    cache.put(sessionID, userResponseTracker);
    const userEnteredData = userResponseTracker[userResponseTracker.length - 1];

    //convert the user entered data to a number
    const contestantCode = parseInt(userEnteredData.userData);
    console.log(contestantCode);

    const users = [
      {
        name: "Oluwaseun",
        contestantCode: 10,
      },
      {
        name: "Oluwaseun",
        contestantCode: 20,
      },
      {
        name: "Oluwaseun",
        contestantCode: 30,
      },
      {
        name: "Oluwaseun",
        contestantCode: "40",
      },
    ];

    const contestant = users.find(
      (user) => user.contestantCode === contestantCode
    );
    // exit the application
    if (!contestant) {
      res.setHeader("Content-Type", "application/json");
      return res.status(200).json({
        userID,
        sessionID,
        message: "Contestant code is invalid, double check again",
        continueSession: false,
        msisdn,
      });
    } else if (lastResponse.page === 1 && contestant) {
      message = "Enter your amount for voting ";
      continueSession = true;

      const currentState = {
        sessionID,
        userID,
        level: 2,
        msisdn,
        message,
        userData,
        network,
        newSession,
        page: 3,
      };

      userResponseTracker.push({ ...currentState });
      cache.put(sessionID, userResponseTracker);
    } else if (lastResponse.page === 3) {
      //make payment

      if (!isNaN(userData) && parseFloat(userData) > 0) {
        const uniqueRef = `${Date.now() + Math.random() * 100}`;
        const paymentRequest = {
          account_number: msisdn,
          merchant_reference: uniqueRef,
          channel: "mobile-money",
          provider: network.toLowerCase(),
          transaction_type: "debit",
          amount: userData,
          purpose: "voting payment",
          service_name: "arkesel voting",
          currency: "GHS",
        };
        const apiKey = process.env.PAYMENT_API_KEY;
        const url =
          "https://payment.arkesel.com/api/v1/payment/charge/initiate";

        axios({
          method: "post",
          url,
          data: { ...paymentRequest },
          headers: {
            "api-key": apiKey,
          },
        })
          .then((res) => res.data)
          .then((data) => {
            console.log({ data }, "Initiate payment");
            // Save into DB
            // If it was successful then send message
            message = `Kindly enter your pin for the approval of GHS ${userData} debiting of your Mobile money account. We are charging you for voting. Dial *170# to visit approvals if one doesn't pop up!`;
            continueSession = false;
          });

        message = `Kindly enter your pin for the approval of GHS ${userData} debiting of your Mobile money account. We are charging you for voting. Dial *170# to visit approvals if one doesn't pop up!`;
        continueSession = false;

        res.setHeader("Content-Type", "application/json");
        return res.status(200).json({
          userID,
          sessionID,
          message,
          continueSession,
          msisdn,
        });
      } else {
        message = "You entered an invalid amount: ";
        continueSession = true;

        const currentState = {
          sessionID,
          userID,
          level: 3,
          msisdn,
          message,
          userData,
          network,
          newSession,
          page: 1,
        };

        userResponseTracker.push({ ...currentState });
        cache.put(sessionID, userResponseTracker);
      }
    } else if (["1", "2", "3", "4"].includes(userData)) {
      message = "Thank you for voting!";
      continueSession = false;
    } else if (userData === "5") {
      message = "Enter your amount to pay below: ";
      continueSession = true;

      const currentState = {
        sessionID,
        userID,
        level: 3,
        msisdn,
        message,
        userData,
        network,
        newSession,
        page: 1,
      };

      userResponseTracker.push({ ...currentState });
      cache.put(sessionID, userResponseTracker);
    } else {
      message = "Bad choice!";
      continueSession = false;
    }
  } else if (lastResponse.level === 3) {
    if (!isNaN(userData) && parseFloat(userData) > 0) {
      const uniqueRef = `${Date.now() + Math.random() * 100}`;
      const paymentRequest = {
        account_number: msisdn,
        merchant_reference: uniqueRef,
        channel: "mobile-money",
        provider: network.toLowerCase(),
        transaction_type: "debit",
        amount: userData,
        purpose: "voting payment",
        service_name: "arkesel voting",
        currency: "GHS",
      };
      const apiKey = process.env.PAYMENT_API_KEY;
      const url = "https://payment.arkesel.com/api/v1/payment/charge/initiate";

      axios({
        method: "post",
        url,
        data: { ...paymentRequest },
        headers: {
          "api-key": apiKey,
        },
      })
        .then((res) => res.data)
        .then((data) => {
          console.log({ data }, "Initiate payment");
          // Save into DB
          // If it was successful then send message
          message = `Kindly enter your pin for the approval of GHS ${userData} debiting of your Mobile money account. We are charging you for voting. Dial *170# to visit approvals if one doesn't pop up!`;
          continueSession = false;
        });

      message = `Kindly enter your pin for the approval of GHS ${userData} debiting of your Mobile money account. We are charging you for voting. Dial *170# to visit approvals if one doesn't pop up!`;
      continueSession = false;

      res.setHeader("Content-Type", "application/json");
      return res.status(200).json({
        userID,
        sessionID,
        message,
        continueSession,
        msisdn,
      });
    } else {
      message = "You entered an invalid amount: ";
      continueSession = true;

      const currentState = {
        sessionID,
        userID,
        level: 3,
        msisdn,
        message,
        userData,
        network,
        newSession,
        page: 1,
      };

      userResponseTracker.push({ ...currentState });
      cache.put(sessionID, userResponseTracker);
    }
  }

  //Return response to user
  res.setHeader("Content-Type", "application/json");
  return res.status(200).json({
    userID,
    sessionID,
    message,
    continueSession,
    msisdn,
  });
});

// Callback URL for payment
app.get("/payments/arkesel/callback", (req, res) => {
  console.log({ query: res.query }, "Callback for Arkesel payment");
  // Verify the payment...

  res.setHeader("Content-Type", "application/json");
  return res.status(200).json({
    status: "success",
    message: "arkesel payment callback called",
  });
});

// Verify payment
app.get("/payments/verify", (req, res) => {
  const apiKey = process.env.PAYMENT_API_KEY;
  const transRef = "T634E3e8cac8175";
  const url = `https://payment.arkesel.com/api/v1/verify/transaction/${transRef}`;

  axios({
    method: "get",
    url,
    headers: {
      "api-key": apiKey,
    },
  })
    .then((res) => res.data)
    .then((data) => {
      console.log({ data }, "Verify payment");
      // Update payment status in DB
    });
  res.setHeader("Content-Type", "application/json");
  return res.status(200).json({
    status: "success",
    message: "payment verification called",
  });
});

app.listen(8000, function () {
  console.log("Easy Vote GH USSD app listening on 8000!");
});
