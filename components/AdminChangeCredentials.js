import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { ArrowLeft, UserCheck, Lock } from 'lucide-react';

export function AdminChangeCredentials() {
    const [activeTab, setActiveTab] = useState('username');
    const [currentUsername, setCurrentUsername] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [currentPasswordForPass, setCurrentPasswordForPass] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleUsernameSubmit = async (e) => {
        e.preventDefault();
        if (newUsername.length < 3) {
            setMessage('New username must be at least 3 characters.');
            return;
        }
        setLoading(true);
        setMessage('');
        // Placeholder for changing username
        setTimeout(() => {
            setMessage('Username changed successfully. Please login with new username.');
            setLoading(false);
            setTimeout(() => navigate('/?page=admin-login'), 2000);
        }, 1500);
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            setMessage('New password must be at least 6 characters.');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setMessage('New passwords do not match.');
            return;
        }
        setLoading(true);
        setMessage('');
        // Placeholder for changing password
        setTimeout(() => {
            setMessage('Password changed successfully. Please login with new password.');
            setLoading(false);
            setTimeout(() => navigate('/?page=admin-login'), 2000);
        }, 1500);
    };

    return (_jsx("div", { className: "min-h-screen bg-slate-900 flex items-center justify-center p-4", children: _jsxs(Card, { className: "w-full max-w-md bg-slate-800/50 border-slate-700", children: [_jsxs(CardHeader, { children: [_jsxs("div", { className: "flex items-center gap-3 mb-4", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => navigate('/?page=admin-login'), className: "text-gray-400 hover:text-white transition-colors duration-200", children: _jsx(ArrowLeft, { className: "w-4 h-4" }) }), _jsx(UserCheck, { className: "w-8 h-8 text-cyan-400" })] }), _jsx(CardTitle, { className: "text-white text-center", children: "Change Credentials" }), _jsx(CardDescription, { className: "text-gray-400 text-center", children: "Select what you want to change" })] }), _jsxs(CardContent, { children: [_jsx(Tabs, { value: activeTab, onValueChange: setActiveTab, className: "w-full", children: [_jsx(TabsList, { className: "grid w-full grid-cols-2", children: [_jsx(TabsTrigger, { key: "username-tab", value: "username", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(UserCheck, { className: "w-4 h-4" }), "Username"] }) }), _jsx(TabsTrigger, { key: "password-tab", value: "password", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Lock, { className: "w-4 h-4" }), "Password"] }) })] }), _jsx(TabsContent, { value: "username", className: "mt-4 space-y-4", children: _jsxs("form", { onSubmit: handleUsernameSubmit, children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "currentUsername", className: "text-white", children: "Current Username" }), _jsx(Input, { id: "currentUsername", type: "text", value: currentUsername, onChange: (e) => setCurrentUsername(e.target.value), required: true, autocomplete: "username", className: "bg-slate-700 border-slate-600 text-white", placeholder: "Enter current username" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "currentPassword", className: "text-white", children: "Current Password" }), _jsx(Input, { id: "currentPassword", type: "password", value: currentPassword, onChange: (e) => setCurrentPassword(e.target.value), required: true, autocomplete: "current-password", className: "bg-slate-700 border-slate-600 text-white", placeholder: "Enter current password" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "newUsername", className: "text-white", children: "New Username" }), _jsx(Input, { id: "newUsername", type: "text", value: newUsername, onChange: (e) => setNewUsername(e.target.value), required: true, autocomplete: "username", className: "bg-slate-700 border-slate-600 text-white", placeholder: "Enter new username" })] }), _jsx(Button, { type: "submit", className: "w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200", disabled: loading, children: loading ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" }), "Updating..."] })) : ('Change Username') })] }) }), _jsx(TabsContent, { value: "password", className: "mt-4 space-y-4", children: _jsxs("form", { onSubmit: handlePasswordSubmit, children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "currentPasswordForPass", className: "text-white", children: "Current Password" }), _jsx(Input, { id: "currentPasswordForPass", type: "password", value: currentPasswordForPass, onChange: (e) => setCurrentPasswordForPass(e.target.value), required: true, autocomplete: "current-password", className: "bg-slate-700 border-slate-600 text-white", placeholder: "Enter current password" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "newPassword", className: "text-white", children: "New Password" }), _jsx(Input, { id: "newPassword", type: "password", value: newPassword, onChange: (e) => setNewPassword(e.target.value), required: true, autocomplete: "new-password", className: "bg-slate-700 border-slate-600 text-white", placeholder: "Enter new password" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "confirmNewPassword", className: "text-white", children: "Confirm New Password" }), _jsx(Input, { id: "confirmNewPassword", type: "password", value: confirmNewPassword, onChange: (e) => setConfirmNewPassword(e.target.value), required: true, autocomplete: "new-password", className: "bg-slate-700 border-slate-600 text-white", placeholder: "Confirm new password" })] }), _jsx(Button, { type: "submit", className: "w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200", disabled: loading, children: loading ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" }), "Updating..."] })) : ('Change Password') })] }) })] }), message && (_jsx("div", { className: `mt-4 p-3 border rounded-md text-sm text-center ${message.includes('successfully') ? 'bg-green-900/50 border-green-600 text-green-300' : 'bg-red-900/50 border-red-600 text-red-300'}`, children: message })), _jsx("div", { className: "mt-4 text-center", children: _jsx(Button, { variant: "link", onClick: () => navigate('/?page=admin-login'), className: "text-sm text-gray-400 hover:text-white p-0 h-auto", children: "Back to Login" }) })] })] }) }));
}
