const mongoose = require("mongoose");
const validator = require('validator');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const userSchema = mongoose.Schema({
    name:{
        type: String,
        required: "Please enter the firstName",
        maxLength:50,
        minLength: 4
    },
    emailId:{
        type: String, 
        lowercase: true,
        trim: true,
        required: true,
        unique: true,
        validate(value){
            if(!validator.isEmail(value)){
                throw new Error("Invalid email address")
            }
        }
    },
    password:{
        type: String,
        required: true,
        validate(value){
            if(!validator.isStrongPassword(value)){
                throw new Error("Enter a strong password")
            }
        }
    },
    isPremium:{
        type:Boolean,
        default: false
    },
    membershipType:{
        type:String,
    },

}, {timestamps: true});

userSchema.methods.getJWT = async function(){
    const user = this;
    const token = await jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
    return token;
}
userSchema.methods.validatePassword = async function(passwordInputByUser){
    const user = this;
    const isValidated =  await bcrypt.compare(passwordInputByUser, user.password);
    return isValidated;
}

const Users = mongoose.model("User", userSchema);
module.exports = Users;