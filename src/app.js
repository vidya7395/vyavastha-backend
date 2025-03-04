const express = require("express");
const app = express();
const { connectDB } = require("./config/database")
const cookieParser = require('cookie-parser')
const cors = require('cors')
const http = require('http');
require("dotenv").config();


app.use(cors({
    origin: "http://localhost:5173",  // Allow frontend origin
    credentials: true,                 // Allow cookies if needed
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",  // Explicitly allow PATCH,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));
app.use(express.json());
app.use(cookieParser());
const authRouter = require("./routes/auth");
const budgetRouter = require("./routes/budget");
const categoryRouter = require("./routes/category");
const transactionRouter = require("./routes/transaction");

app.use("/api/auth", authRouter);
app.use("/api", budgetRouter);
app.use("/api", categoryRouter);
app.use("/api", transactionRouter);

connectDB()
    .then(() => {
        console.log("Database connection establish");
        app.listen("3000", () => {
            console.log("Server is listening to 3000");

        });

    })
    .catch((error) => {
        console.log("Database cannot be connected"+error.message);

    })
