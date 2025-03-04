const express = require("express");
const authRouter = express.Router();
const {validatingSignUpData} = require("../utils/validators");
const bcrypt = require("bcrypt");
const Users = require("../model/user");
const validator = require("validator");
const { userAuth } = require("../middlewares/auth");
const { default: mongoose } = require("mongoose");

module.exports = authRouter;
authRouter.post("/signup", async (req, res) => {    
    try {
        const { name, password,  emailId} = req.body;
        validatingSignUpData(req);
        const passwordHash = await bcrypt.hash(password, 10);
        const user = new Users({
            name,
            password: passwordHash,
            emailId,
        });
        const savedUser = await user.save();
        const token = await savedUser.getJWT();
        res.cookie("token", token, {
            expires: new Date(Date.now() + 8 * 3600000),
        });
        res.json({
            message:"User Added successfully",
            data:savedUser
        });

    } catch (error) {
        res.status(400).send("ERROR: " + error.message)
    }


});
authRouter.post("/login", async (req, res) => {

    try {
        const { emailId, password } = req.body;
        if (!validator.isEmail(emailId)) throw new Error("Email is not valid");
        const user = await Users.findOne({ emailId });
        if (!user) throw new Error("Invalid credentials!");
        const isPasswordValid = await user.validatePassword(password);
        if (!isPasswordValid) throw new Error("Invalid Credentials !")


        else {
            const token = await user.getJWT();
            res.cookie("token", token, {
                expires: new Date(Date.now() + 8 * 3600000),
            });
            res.send(user)
        }

    } catch (error) {
        res.status(400).send("ERROR: " + error.message)
    }
});
authRouter.post("/logout", async(req,res)=>{
    try {
        res.cookie("token", null,{
            expires: new Date(Date.now())
        }).send("Logout successfully !!");
    } catch (error) {
        res.send("ERROR:" + error.message);
    }
});
authRouter.get("/me",userAuth, async(req,res)=>{
    try {
        const userId = req.user._id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });
        const user = await Users.findById( new mongoose.Types.ObjectId(userId) );        
        return res.status(201).json({ user});
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }
});