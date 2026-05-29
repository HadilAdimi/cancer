const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

const User = require("../models/User");

const {
  login
} = require("../controllers/authController");

router.post("/login", login);
module.exports = router;

