const notFound = (req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: "NOT_FOUND",
            message: "The requested resource was not found."
        }
    });
};

export default notFound;