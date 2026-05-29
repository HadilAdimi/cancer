const User = require("../models/User");

const bcrypt = require("bcryptjs");

exports.getUsers = async (req, res) => {

  const users = await User.find({
    role: { $in: ["doctor", "researcher"] }
  });

  res.json(users);
};

exports.addUser = async (req, res) => {

  const { username, password, role } = req.body;

  try {

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const newUser = new User({
      username,
      password: hashedPassword,
      role
    });

    await newUser.save();

    res.json({
      message: "User added"
    });

  } catch (error) {

    res.status(500).json({
      message: "Error adding user"
    });
  }
};

exports.updateUser = async (req, res) => {

  const { username, password, role } = req.body;

  try {

    const updateData = {
      username,
      role
    };

    if (password) {

      updateData.password =
        await bcrypt.hash(password, 10);
    }

    await User.findByIdAndUpdate(
      req.params.id,
      updateData
    );

    res.json({
      message: "User updated"
    });

  } catch (error) {

    res.status(500).json({
      message: "Error updating user"
    });
  }
};

exports.deleteUser = async (req, res) => {

  try {

    await User.findByIdAndDelete(req.params.id);

    res.json({
      message: "User deleted"
    });

  } catch (error) {

    res.status(500).json({
      message: "Error deleting user"
    });
  }
};