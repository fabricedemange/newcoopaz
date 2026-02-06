const csurf = require("csurf");

const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  },
  value: (req) => {
    return req.body?._csrf || req.headers["csrf-token"] || req.headers["xsrf-token"] || req.headers["x-csrf-token"];
  },
});

module.exports = csrfProtection;
