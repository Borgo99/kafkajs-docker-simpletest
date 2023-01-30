const express = require("express");
const mongoose = require("mongoose");
const { Kafka } = require("kafkajs");

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
  clientId: "app2",
  brokers: [process.env.KKAFKA_BOOTSTRAP_SERVERS],
  logCreator: MyLogCreator,
});
const producer = kafka.producer();
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

  // Consumer logic
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      console.log("New message received");
      await User.create(JSON.parse(message.value));
      console.log("New User Created");
    },
  });
};
runKafka().catch(console.error);

app.get("/get-users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

app.listen(process.env.PORT, () => {
  console.log("Service app2 listening on ", process.env.PORT);
});
