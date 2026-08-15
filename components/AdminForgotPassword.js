import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { ArrowLeft, Mail } from 'lucide-react';

export function AdminForgotPassword() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        // Placeholder for sending reset email
        // In production, integrate with AuthContext or email service
        setTimeout(() => {
            setMessage('Reset link sent to your email. Check your inbox.');
            setLoading(false);
        }, 1500);
    };

    return (_jsx("div", { className: "min-h-screen bg-slate-900 flex items-center justify-center p-4", children: _jsxs(Card, { className: "w-full max-w-md bg-slate-800/50 border-slate-700", children: [_jsxs(CardHeader, { children: [_jsxs("div", { className: "flex items-center gap-3 mb-4", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => navigate('/?page=admin-login'), className: "text-gray-400 hover:text-white transition-colors duration-200", children: _jsx(ArrowLeft, { className: "w-4 h-4" }) }), _jsx(Mail, { className: "w-8 h-8 text-cyan-400" })] }), _jsx(CardTitle, { className: "text-white text-center", children: "Forgot Password" }), _jsx(CardDescription, { className: "text-gray-400 text-center", children: "Enter your email to receive a password reset link" })] }), _jsxs(CardContent, { children: [_jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "email", className: "text-white", children: "Admin Email" }), _jsx(Input, { id: "email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true, className: "bg-slate-700 border-slate-600 text-white", placeholder: "Enter your admin email" })] }), _jsx(Button, { type: "submit", className: "w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200", disabled: loading, children: loading ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" }), "Sending..."] })) : ('Send Reset Link') })] }), message && (_jsx("div", { className: "mt-4 p-3 bg-green-900/50 border border-green-600 rounded-md text-green-300 text-sm text-center", children: message })), _jsx("div", { className: "mt-4 text-center", children: _jsx(Button, { variant: "link", onClick: () => navigate('/?page=admin-login'), className: "text-sm text-gray-400 hover:text-white p-0 h-auto", children: "Back to Login" }) })] })] }) }));
}
