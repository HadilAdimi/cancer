const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const role = require("../middleware/role");

const {
  getUsers,
  addUser,
  updateUser,
  deleteUser
} = require("../controllers/adminController");

router.get(
  "/users",
  auth,
  role("admin"),
  getUsers
);

router.post(
  "/users",
  auth,
  role("admin"),
  addUser
);

router.put(
  "/users/:id",
  auth,
  role("admin"),
  updateUser
);

router.delete(
  "/users/:id",
  auth,
  role("admin"),
  deleteUser
);

module.exports = router;