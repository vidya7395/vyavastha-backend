const jwt = require("jsonwebtoken");
const Users = require("../model/user");
const adminAuth = (req, res, next) => {
    const requestToken = "xyzeee";
    let isAuthenticated = false;
    if (requestToken === "xyz") isAuthenticated = true;
    if (isAuthenticated) {
        next();
    }
    else {
        res.status(401).send("User is not authorized")
    }

}

const userAuth = async (req, res, next) => {
   try {
     const  token  = await req.cookies?.token;     
     if (!token) {
         return res.status(401).send("Token ISSUE Please login again!");
     }
     const decodedObj = await jwt.verify(token, process.env.JWT_SECRET);
     const { _id } = decodedObj;
     if (!_id) {
         throw new Error("Please login again!")
     }
     const user = await Users.findById(_id);
     if(!user){
        throw new Error("User not found!")
     }
     req.user = user;
     next();
   } catch (error) {
    res.status(400).send("ERROR:" +error.message);
   }
    
}





module.exports = {
    adminAuth,
    userAuth
}