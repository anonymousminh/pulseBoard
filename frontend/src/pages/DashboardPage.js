import { useEffect, useState } from "react";
import {useNavigate} from "react-router-dom";
import {getUser} from "../utils/auth";
import Header from "../components/Header";

export default function DashboardPage() {
  const [username, setUserName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if the token exists in localStorage
    const token = localStorage.getItem("token");

    if (!token){
      navigate('/');
    } else {
      try {
        const user = getUser();
        setUserName(user.sub);
        setAvatarUrl(user.avatar_url);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching user: ", error);
        setIsLoading(false);
      }
      
    }
  }, []);

  if (loading) return <p>Loading...</p>

  return (
    <>
      <Header username={username}/>
      <h1>Welcome, {username}</h1>
    </>
  );
}