'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation'; // used for redirecting
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";

export default function SignupPage() {
    const router = useRouter();

    const [formData, setFormData] = useState({
        username: '',
        display_name: '',
        email: '',
        password: '',
    });

    // status holds success/error messages
    const [status, setStatus] = useState<{ error: boolean; msg: string } | null>(null);
    // loading disables the submit button
    const [loading, setLoading] = useState(false);

    // helper function that updates the form e.target.name with e.target.value
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // called when the form is submitted
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault(); // prevent full-page refresh
        setLoading(true); // disable the submit button
        setStatus(null); // clear any previous status messages and display "Creating Account..."

        try { // handle API request
            const res = await fetch('http://localhost:8080/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData), // send form data as JSON
            });

            if (!res.ok) { // if the request failed
                const errorText = await res.text(); // get error message
                throw new Error(errorText || 'Signup failed');
            }

            setStatus({ error: false, msg: 'Account created! Redirecting...' }); // display success message
            setTimeout(() => router.push('/'), 1000); // redirect to home page in 1sec
        } catch (err: any) {
            setStatus({ error: true, msg: err.message }); // display error message
        } finally {
            setLoading(false); // enable the submit button
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground transition-colors duration-300">
            {/* Main Card Container */}
            <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-xl border border-border shadow-lg">

                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl tracking-tight">Join Praxis</h1>
                </div>

                {/* Status Message */}
                {status && (
                    <div className={`p-3 rounded-md text-sm font-medium border ${status.error
                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                        : 'bg-green-500/10 text-green-500 border-green-500/20'
                        }`}>
                        {status.msg}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">

                        <div className="space-y-4">
                            <FloatingLabelInput
                                id="username"
                                name="username"
                                type="text"
                                label="Username"
                                value={formData.username}
                                required
                                onChange={handleChange}
                            />
                            <FloatingLabelInput
                                id="display_name"
                                name="display_name"
                                type="text"
                                label="Display Name"
                                value={formData.display_name}
                                required
                                onChange={handleChange}
                            />
                            <FloatingLabelInput
                                id="email"
                                name="email"
                                type="email"
                                label="Email"
                                value={formData.email}
                                required
                                onChange={handleChange}
                            />
                            <FloatingLabelInput
                                id="password"
                                name="password"
                                type="password"
                                label="Password"
                                value={formData.password}
                                required
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
                    >
                        {loading ? 'Creating Account...' : 'Sign Up'}
                    </button>
                </form>

                <div className="text-center text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <a href="/login" className="underline underline-offset-4 hover:text-primary">
                        Login
                    </a>
                </div>
            </div>
        </div>
    );
}