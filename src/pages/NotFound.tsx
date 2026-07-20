import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-lg mx-auto mb-5">
          <span className="text-2xl font-extrabold text-white">?</span>
        </div>
        <h1 className="mb-2 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-5 text-base text-muted-foreground">Oops! This page doesn't exist.</p>
        <a href="/" className="text-primary font-medium underline underline-offset-4 hover:text-primary/80 transition-colors">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
