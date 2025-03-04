const validator = require('validator');
const validatingSignUpData = (req) => {
    const {name:firstName ,emailId,password}= req.body;
    if(!(firstName.length > 3 && firstName.length < 50)){
        throw new Error("First Name should be between 4 - 50 characters!")
    }
    if(!(validator.isEmail(emailId))){
        throw new Error("Email Id is not valid!")
    }
    if(!(validator.isStrongPassword(password))){
        throw new Error("Password should be strong!")
    }
}
const validateUser = (req)=>{
    const allowedFields = ["name"];
    const isUpdateAllowed = Object.keys(req).every((key)=>allowedFields.includes(key));
    return isUpdateAllowed;
}
module.exports = {
    validatingSignUpData,
    validateUser
}