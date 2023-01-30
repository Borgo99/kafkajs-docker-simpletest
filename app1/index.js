const express = require("express");
const mongoose = require("mongoose");
const { Kafka, Partitioners, logLevel } = require("kafkajs");

const app = express();
app.use(express.json());

const User = new mongoose.model("user", {
  name: String,
  email: String,
  password: String,
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"));

const MyLogCreator =
  (logLevel) =>
  ({ namespace, level, label, log }) => {
    const { timestamp, logger, message, ...others } = log;
    if (namespace) {
      namespace = ` [${namespace}]`;
    } else {
      namespace = "";
    }
    console.log(`${label} -${namespace} ${message} `);
  };
const kafka = new Kafka({
  clientId: "app1",
  brokers: [process.env.KKAFKA_BOOTSTRAP_SERVERS],
  logCreator: MyLogCreator,
});
const producer = kafka.producer(
  // See https://kafka.js.org/docs/migration-guide-v2.0.0
  { createPartitioner: Partitioners.LegacyPartitioner }
);
const consumer = kafka.consumer({ groupId: process.env.KAFKA_TEST_GROUP });

const runKafka = async () => {
  console.log("Connecting to Kafka...");
  console.log("Connecting producer...");
  await producer.connect();
  console.log("Connecting consumer...");
  await consumer.connect();
  console.log("Subscribing consumer...");
  await consumer.subscribe({
    topics: [process.env.KAFKA_TOPIC],
    fromBeginning: false,
  });
  console.log("Connected to Kafka!");
};
runKafka().catch(console.error);

app.post("/create-user", async (req, res) => {
  const { name, email, password } = req.body;
  await User.create(req.body);
  console.log("User Created. Sending to Kafka...");
  await producer.send({
    topic: process.env.KAFKA_TOPIC,
    messages: [{ value: JSON.stringify({ name, email, password }) }],
  });
  console.log("New user sent to Kafka!");
  res.json({ status: "success", email });
});

app.listen(process.env.PORT, () => {
  console.log("Service app1 listening on ", process.env.PORT);
});
