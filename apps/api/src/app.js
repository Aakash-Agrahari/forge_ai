import express from "express";

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/api/v1/health", (req,res) => {
    res.status(200).json({
        success: true,
        message: "ForgeAI API is running",
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`ForgeAI API running on port ${PORT}`);
});