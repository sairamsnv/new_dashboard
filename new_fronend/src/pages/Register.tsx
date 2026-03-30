import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Auth from "./Auth";

const Register = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/login?view=signup", { replace: true });
  }, [navigate]);
  return <Auth />;
};

export default Register;
