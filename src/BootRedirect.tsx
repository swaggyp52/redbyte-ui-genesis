import { useEffect } from "react";

export default function BootRedirect() {
  useEffect(() => {
    if (!sessionStorage.getItem("booted")) {
      sessionStorage.setItem("booted", "1");
      window.location.href = "/boot";
    }
  }, []);

  return null;
}
