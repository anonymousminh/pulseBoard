import React from "react";
import { useNavigate } from "react-router-dom";

const Header = ({username, avatarUrl}) => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate('/');
    };

    return (
        <header style={styles.header}>
            <div style={styles.userContainer}>
                <img
                    src={avatarUrl}
                    alt={username}
                    style={styles.avatar}
                />
                <span style={styles.username}>{username}</span>
            </div>
            <button onClick={handleLogout} style={styles.logoutButton}>
                Logout
            </button>
        </header>
    );
};

const styles = {
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #ddd',
    },
    userContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
    },
    avatar: {
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        objectFit: 'cover',
    },
    username: {
        fontWeight: '500',
        fontSize: '1rem',
    },
    logoutButton: {
        padding: '0.5rem 1rem',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.9rem',
    },
};

export default Header;