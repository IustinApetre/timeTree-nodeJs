const express = require(`express`);
const router = express.Router();
// mongodb user model;
const User = require(`./../models/User.js`); //Understand this
// mongodb UserVerification model;
const UserVerification = require(`./../models/UserVerification.js`);

// email handler
const nodemailer = require("nodemailer");
//unique string
const {v4: uuidv4} = require("uuid");
//env variables
require("dotenv").config();
//Password handler
const bcrypt = require(`bcrypt`);
//path for statis verfied page
///nodemailer stuff
let transporter = nodemailer.createTransport({
        service: "gmail",

        auth: {
            user: process.env.AUTH_EMAIL,
            pass: process.env.AUTH_PASS,

        }
    }
)
//testing succes
transporter.verify((error, succes) => {
    if (error) {
        console.log(error);
    } else {
        console.log("Ready for messages");
        console.log(succes);
    }
})
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
    } else if (!/^[a-zA-Z\s]*$/.test(name)) {
        res.json({
            status: "FAILED",
            message: "Invalid name entered"

        })
    } else if (!/^[\w-]+(?:\.[\w-]+)*@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
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
                    message: "User with the provided email already Exists"
                })
            } else {
                //Try to create new user

                //password handling
                const saltRounds = 10;
                bcrypt.hash(password, saltRounds)
                    .then(hashedPassword => {
                        const newUser = new User({
                            name,
                            email,
                            password: hashedPassword,
                            dateOfBirth,
                            verified: false,
                        });
                        newUser.save().then(result => {
                            //handle account verification
                            sendVerificationEmail(result, res);
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
})//send verification email
const sendVerificationEmail = ({_id, email}, res) => {
    //url to be used in the mail
    const currentUrl = "http://localhost:5000/"
    const uniqueString = uuidv4() + _id;

    //mail options
    const mailOptions = {
        form: process.env.AUTH_EMAIL,
        to: email,
        subject: "Verify your Email",
        html: `<p> Verify your email address to complete the signup and login into your account.
 </p><p>This link<b>expires in 6 hours</b>.</p> <p>Press <a href=${currentUrl + "user/verify/" + _id + "/" + uniqueString}>here</a>
 to proceed.</p>`,
    };
    //hash the uniqueString
    const saltRounds = 10;
    bcrypt.hash(uniqueString, saltRounds)
        .then((hashedUniqueString) => {
            // set values in userVerification collection
            const newVerification = new UserVerification({
                userId: _id,
                uniqueString: hashedUniqueString,
                createdAt: Date.now(),
                expiresAt: Date.now() + 21600000,
            });
            newVerification
                .save()
                .then(() => {
                    transporter.sendMail(mailOptions)
                        .then(() => {
                            //email sent and verification record saved
                            res.json({
                                status: "PENDING",
                                message: "Verification email sent!"
                            })
                        })
                        .catch((error) => {
                            console.log(error);
                            res.json({
                                status: "Failed",
                                message: "Verification email failed!"
                            })
                        })
                })
                .catch((error) => {
                    console.log(error);
                    res.json({
                        status: "Failed",
                        message: "Could not save verification email data!"
                    })

                })
        })
        .catch(() => {
            res.json({
                status: "Failed",
                message: "An error  occurred while hashing email data!"
            })
        })
};
//verify email
router.get("/verify/:userId/:uniqueString", (req, res) => {
    let {userId, uniqueString} = req.params;

    UserVerification
        .find({userId})
        .then((result) => {
            if (result.length > 0) {
                //user verification record exists so we proceed

                const {expiresAt} = result[0];
                const hashedUniqueString = result[0].uniqueString;

                //checking for expired unique string
                if (expiresAt < Date.now()) {
                    //record has expired  so we delete it
                    UserVerification.deleteOne({userId})
                        .then(() => {
                            User.deleteOne({userId})
                                .then(() => {
                                    let message = "Link has expired. Please sign up again"
                                    res.redirect(`/user/verified?error=true&message=${message}`);
                                })
                                .catch(error => {
                                    console.log(error);
                                    let message = " Clearing user with expired unique string failed"
                                    res.redirect(`/user/verified?error=true&message=${message}`);
                                })

                        })
                        .catch((error) => {
                            console.log(error);
                            let message = " An error occured while clearing expired user verification record"
                            res.redirect(`/user/verified?error=true&message=${message}`);
                        })


                } else {//valid record exists so we validate the user string
                    //First compare the hashed unique string

                    bcrypt.compare(uniqueString, hashedUniqueString)
                        .then(result => {
                            if (result) {
                                //string match
                                User.updateOne({_id: userId}, {verified: true})
                                    .then(() => {
                                        UserVerification
                                            .deleteOne({userId})
                                            .then(() => {
                                                res.sendFile(path.join(__dirname, "./../views/verified.html"));
                                            })
                                            .catch(error => {
                                                console.log(error);
                                                let message = " An error occurred while finalizing successful verification"
                                                res.redirect(`/user/verified?error=true&message=${message}`);
                                            })
                                    })
                                    .catch(error => {
                                        {
                                            console.log(error);
                                            let message = " An error occurred while updating user record to show verified"
                                            res.redirect(`/user/verified?error=true&message=${message}`);
                                        }
                                    })
                            } else {
                                //existing record but incorrect verification details passed

                                let message = " Invalid verification details passed. Check your inbox"
                                res.redirect(`/user/verified?error=true&message=${message}`);
                            }
                        })
                        .catch(error => {
                            console.log(error);
                            let message = " An error occurred while comparing unique strings."
                            res.redirect(`/user/verified?error=true&message=${message}`);
                        })

                }
            } else {
                // user verification record does not exist
                console.log("sug");
                let message = "Account record does not exist or has not been verified already. Please sign up or log in"
                res.redirect(`/user/verified?error=true&message=${message}`);
            }
        })
        .catch((error) => {
            console.log(error);
            let message = "An error occurred while checking for existing user verification record"
            res.redirect(`/user/verified?error=true&message=${message}`);

        });

});
//Verified page router
router.get("verified", (req, res) => {
    res.sendFile(path.join(__dirname, "./../views/verified.html"))

})
//Sign in
router.post(`/signin`, (req, res) => {
    let {email, password} = req.body;
    email = email.trim();
    password = password.trim();
    if (!email || !password) {
        res.json({
            status: "Failed",
            message: "Empty credentials supplied"
        })
    } else {
        User.find({email})
            .then(data => {
                if (data.length) {
                    //User exists

                    //check if user is verifie
                    if (!data[0].verified) {
                        res.json({
                            status: "Success",
                            message: "Email has not been verified yet. Check your inbox"

                        })
                    } else {
                        const hashedPassword = data[0].password;
                        bcrypt.compare(password, hashedPassword).then(result => {
                            if (result) {
                                res.json({
                                    status: "Success",
                                    message: "Signin Successful",
                                    data: data
                                })
                            } else {
                                res.json({
                                    status: "FAILED",
                                    message: "Invalid password entered"
                                })
                            }
                        })
                            .catch(err => {
                                console.log(err);
                                res.json({
                                    status: "Failed",
                                    message: "An error occurred while comparing passwords"
                                });
                            });


                    }

                } else {
                    res.json({
                        status: "Failed",
                        message: "Invalid credentials"
                    })
                }
            })
            .catch(err => {
                console.log(err);
                res.json({
                    status: "failed",
                    message: "An error occurred while checking for existing user"
                })
            })
    }
})


module.exports = router;
