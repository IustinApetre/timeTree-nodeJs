const mongoose = require(`mongoose`);
const Schema = mongoose.Schema;

const UserVerificationSchema = new Schema({
    userId: String,
    uniqueString: String,
    createdAt: String,
    expiresAt: Date,
    verified: Boolean
});

const UserVerification = mongoose.model(`UserVerification`, UserVerificationSchema);

module.exports = UserVerification;