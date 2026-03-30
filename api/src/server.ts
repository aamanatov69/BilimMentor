import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorHandler } from "./middleware/errorHandler";
import { lmsRoutes } from "./routes/lmsRoutes";

export const app = express();
const PORT = Number(process.env.PORT ?? 4000);

function resolveTrustProxySetting() {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw) {
    return process.env.NODE_ENV === "production" ? 1 : false;
  }

  if (raw === "true") {
    return true;
  }

  if (raw === "false") {
    return false;
  }

  const asNumber = Number(raw);
  if (Number.isInteger(asNumber) && asNumber >= 0) {
    return asNumber;
  }

  // Keep production safe behind a proxy even if env value is invalid.
  return process.env.NODE_ENV === "production" ? 1 : false;
}

app.set("trust proxy", resolveTrustProxySetting());

app.disable("x-powered-by");

function getAllowedOrigins() {
  const rawOrigins = process.env.CORS_ALLOWED_ORIGINS;
  if (!rawOrigins) {
    return ["http://localhost:3000"];
  }

  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const allowedOrigins = getAllowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  }),
);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    strictTransportSecurity:
      process.env.NODE_ENV === "production"
        ? {
            maxAge: 15552000,
            includeSubDomains: true,
          }
        : false,
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'none'"],
        styleSrc: ["'none'"],
        imgSrc: ["'none'"],
        connectSrc: ["'self'"],
      },
    },
  }),
);
app.use(express.json({ limit: "25mb" }));
app.use(lmsRoutes);
app.use(errorHandler);

export async function bootstrap() {
  app.listen(PORT, () => {
    console.log(`BilimMentor API started on http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  bootstrap().catch((error) => {
    console.error("Failed to start API", error);
    process.exit(1);
  });
}
