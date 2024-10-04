const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

const mongoose = require("mongoose");
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const { Schema } = mongoose;

// Create Schemas
const userSchema = new Schema({
  username: String,
});
const exerciseSchema = new Schema({
  user_id: { type: String, required: true },
  description: String,
  duration: Number,
  date: Date,
});

// Create models
const User = mongoose.model("User", userSchema);
const Exercise = mongoose.model("Exercise", exerciseSchema);

const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: false }));

app.use(cors());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// Helper function to handle UTC offset
const checkDate = (date) => {
  if (!date) {
    return new Date(Date.now()).toDateString();
  } else {
    const parts = date.split("-");
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // Months are 0-indexed in JS
    const day = parseInt(parts[2]);

    const utcDate = new Date(Date.UTC(year, month, day));
    return new Date(
      utcDate.getTime() + utcDate.getTimezoneOffset() * 60000
    ).toDateString();
  }
};

app.route("/api/users").post(async (req, res) => {
  const userDoc = new User({
    username: req.body.username,
  });

  try {
    const user = await userDoc.save();
    res.json(user);
  } catch (err) {
    console.log(err);
  }
});

app.route("/api/users").get(async (req, res) => {
  const users = await User.find({}).select("_id username");
  if (!users) {
    res.send("No users");
  } else {
    res.json(users);
  }
});

app.route("/api/users/:_id/exercises").post(async (req, res) => {
  const id = req.params._id;
  const { description, duration, date } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      res.send("Could not find user");
    } else {
      const exerciseDoc = new Exercise({
        user_id: user._id,
        description,
        duration,
        date: checkDate(date), // Using the checkDate function to adjust the date
      });
      const exercise = await exerciseDoc.save();

      const response = {
        _id: user._id,
        username: user.username,
        description: exercise.description,
        duration: exercise.duration,
        date: exercise.date.toDateString(),
      };

      res.json(response); // Sending the corrected response
    }
  } catch (err) {
    console.log(err);
    res.send("There was an error saving the exercise");
  }
});

app.route("/api/users/:_id/logs").get(async (req, res) => {
  const { from, to, limit } = req.query;
  const id = req.params._id;
  const user = await User.findById(id);
  if (!user) {
    return res.send("Did not find user");
  }

  let dateObj = {};
  if (from) {
    dateObj["$gte"] = new Date(from);
  }
  if (to) {
    dateObj["$lte"] = new Date(to);
  }

  let filter = {
    user_id: id,
  };
  if (from || to) {
    filter.date = dateObj;
  }

  const exercises = await Exercise.find(filter).limit(+limit ?? 500);

  const log = exercises.map((el) => ({
    description: el.description,
    duration: el.duration,
    date: new Date(el.date).toDateString(),
  }));

  const userLog = {
    username: user.username,
    count: log.length,
    _id: user._id,
    log,
  };

  res.json(userLog);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
