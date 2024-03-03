const express = require(`express`);
const router = express.Router();
// mongodb user model;
const User = require(`./../models/User.js`); //Understand this
//Password handler
const bcrypt = require(`bcrypt`)
//SignUp
router.post(`/signup`, (req, res) => {
    let {name, email, password, dateOfBirth} = req.body;
    name = name.trim();
    email = email.trim();
    password = password.trim();
    dateOfBirth = dateOfBirth.trim();

    if (!name || !email || !password || !dateOfBirth) {
        res.json({
            status: "FAILED",
            message: "Empty input failed!"
        });
    } else if (!/^[a-zA-Z]*$/.test(name)) {
        res.json({
            status: "FAILED",
            message: "Invalid name entered"

        })
    } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        res.json({
            status: "FAILED",
            message: "Invalid email entered"

        })
    } else if (!new Date(dateOfBirth).getTime()) {
        res.json({
            status: "FAILED",
            message: "Invalid date of birth entered"

        })
    } else if (password.length < 8) {
        res.json({
            status: "FAILED",
            message: "Password is too short!"

        })
    } else {
        User.find({email}).then(result => {
            if (result.length) {
                res.json({
                    status: "FAILED",
                    message: "User with the provided email already exists"
                })
            } else {
                //Try to create new user

                //password handling
                const saltRounds = 10;
                bcrypt.hash(password, saltRounds).then(hashedPassword => {
                    const newUser = new User({
                        name,
                        email,
                        password: hashedPassword,
                        dateOfBirth
                    });
                    newUser.save().then(result => {
                        res.json({
                            status: "SUCCESS",
                            message: "Signup successful",
                            data: result,
                        })
                    })
                        .catch(err => {
                            console.log(err);
                            res.json({
                                status: "FAILED",
                                message: "An  error occurred while saving user account"
                            })
                        })
                })
                    .catch(err => {
                        console.log(err);
                        res.json({
                            status: "FAILED",
                            message: "An  error occurred while hashing password"
                        })

                    })
            }
        }).catch(err => {
            console.log(err);
            res.json({
                status: "Failed",
                message: "An error occurred while checking for existing user!"
            })
        })
    }
})
router.post(`signin`, (req, res) => {

})

module.exports = router;
