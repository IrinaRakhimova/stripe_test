require("dotenv").config();
const express = require("express");
const path = require("path");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

let storedPayment = null;

app.post("/create-payment-intent", async (req, res) => {
  const { amount, startTime, participants } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      capture_method: "manual",
    });

    storedPayment = {
      id: paymentIntent.id,
      amount,
      startTime: new Date(startTime),
      participants,
    };

    scheduleCapture(storedPayment);

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const scheduleCapture = ({ id, amount, startTime, participants }) => {
  const delay = startTime.getTime() + 60_000 - Date.now();

  if (delay <= 0) {
    console.log("Too late. Capturing now.");
    return capturePayment(id, amount, participants);
  }

  console.log(`Scheduling capture in ${Math.round(delay / 1000)}s`);

  setTimeout(() => {
    capturePayment(id, amount, participants);
  }, delay);
};

const capturePayment = async (paymentIntentId, amount, participants) => {
  if (!paymentIntentId) {
    console.log("No payment intent to capture.");
    return;
  }

  const finalAmount = Math.floor(amount / participants);

  try {
    await stripe.paymentIntents.capture(paymentIntentId, {
      amount_to_capture: finalAmount,
    });
    console.log(`Captured $${(finalAmount / 100).toFixed(2)} from test card.`);
  } catch (err) {
    console.error("Capture failed:", err.message);
  }
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
