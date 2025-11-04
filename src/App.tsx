import { useEffect, useState } from "react";
import { ParserDrill, ReverseParser } from "./components";

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.hash || "#/");

  // Simple client-side routing without react-router
  // Handle hash-based navigation for SPA compatibility
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.hash || "#/");
    };
    
    const handlePopState = () => {
      handleLocationChange();
    };
    
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('locationchange', handleLocationChange);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('locationchange', handleLocationChange);
    };
  }, []);

  // Render based on path
  if (currentPath === "#/reverse") {
    return <ReverseParser />;
  }

  return <ParserDrill />;
}
