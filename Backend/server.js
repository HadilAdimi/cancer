const express = require("express");

const cors = require("cors");

const dotenv = require("dotenv");

const connectDB = require("./config/db");

const Report = require("./routes/reportRoutes");


dotenv.config();

connectDB();

const app = express();

app.use(cors());

app.use(express.json());

app.use(
  "/auth",
  require("./routes/authRoutes")
);

app.use(
  "/admin",
  require("./routes/adminRoutes")
);

app.use(
  "/patients",
  require("./routes/patientRoutes")
);

app.use("/reports", Report);


app.use(
  "/uploads",
  express.static("uploads")
);
app.use("/researcher", require("./routes/researcherRoutes"));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});