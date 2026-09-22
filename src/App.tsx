import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Admin } from "./components/Admin";
import { ReverseParser } from "./components/ReverseParser";
import { VerseSession } from "./components/VerseSession";
import { WeakSpots } from "./components/WeakSpots";
import { SessionProvider } from "./session";

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="/" element={<VerseSession />} />
          <Route path="/reverse" element={<ReverseParser />} />
          <Route path="/weak-spots" element={<WeakSpots />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/:userId" element={<Admin />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
