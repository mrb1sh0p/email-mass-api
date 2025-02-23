import helmet from "helmet";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import router from "./routes/router";

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: "10mb" }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
});

app.use(limiter);

app.use(router);
app.listen(3030, () => {
  console.log("server is running");
});
