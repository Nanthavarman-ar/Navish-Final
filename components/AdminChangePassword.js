import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { ArrowLeft, Lock } from 'lucide-react';

export function AdminChangePassword() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
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
        // Placeholder for changing password
        // In production, verify current password and update via AuthContext
        setTimeout(() => {
            setMessage('Password changed successfully. Please login with new password.');
            setLoading(false);
            setTimeout(() => navigate('/?page=admin-login'), 2000);
        }, 1500);
    };

    return (_jsx("div", { className: "min-h-screen bg-slate-900 flex items-center justify-center p-4", children: _jsxs(Card, { className: "w-full max-w-md bg-slate-800/50 border-slate-700", children: [_jsxs(CardHeader, { children: [_jsxs("div", { className: "flex items-center gap-3 mb-4", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => navigate('/?page=admin-login'), className: "text-gray-400 hover:text-white transition-colors duration-200", children: _jsx(ArrowLeft, { className: "w-4 h-4" }) }), _jsx(Lock, { className: "w-8 h-8 text-cyan-400" })] }), _jsx(CardTitle, { className: "text-white text-center", children: "Change Password" }), _jsx(CardDescription, { className: "text-gray-400 text-center", children: "Enter your current password and new password" })] }), _jsxs(CardContent, { children: [_jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "currentPassword", className: "text-white", children: "Current Password" }), _jsx(Input, { id: "currentPassword", type: "password", value: currentPassword, onChange: (e) => setCurrentPassword(e.target.value), required: true, className: "bg-slate-700 border-slate-600 text-white", placeholder: "Enter current password" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "newPassword", className: "text-white", children: "New Password" }), _jsx(Input, { id: "newPassword", type: "password", value: newPassword, onChange: (e) => setNewPassword(e.target.value), required: true, className: "bg-slate-700 border-slate-600 text-white", placeholder: "Enter new password" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "confirmNewPassword", className: "text-white", children: "Confirm New Password" }), _jsx(Input, { id: "confirmNewPassword", type: "password", value: confirmNewPassword, onChange: (e) => setConfirmNewPassword(e.target.value), required: true, className: "bg-slate-700 border-slate-600 text-white", placeholder: "Confirm new password" })] }), _jsx(Button, { type: "submit", className: "w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200", disabled: loading, children: loading ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" }), "Updating..."] })) : ('Change Password') })] }), message && (_jsx("div", { className: `mt-4 p-3 border rounded-md text-sm text-center ${message.includes('successfully') ? 'bg-green-900/50 border-green-600 text-green-300' : 'bg-red-900/50 border-red-600 text-red-300'}`, children: message })), _jsx("div", { className: "mt-4 text-center", children: _jsx(Button, { variant: "link", onClick: () => navigate('/?page=admin-login'), className: "text-sm text-gray-400 hover:text-white p-0 h-auto", children: "Back to Login" }) })] })] }) }));
}
