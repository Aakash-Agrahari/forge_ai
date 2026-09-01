const SESSION_COOKIE_NAME = 'forgeai_session';

const SESSION_DURATION_MS = 30*24*60*60*1000; //30 days in milliseconds

function getSessionCookieOptions(){
    const isProduction = process.env.NODE_ENV === "production";

    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_DURATION_MS
    };
}

function getSessionClearCookieOptions(){
    const isProduction = process.env.NODE_ENV === "production";

    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/"
    };
}

export{
    SESSION_COOKIE_NAME,
    SESSION_DURATION_MS,
    getSessionCookieOptions,
    getSessionClearCookieOptions
};