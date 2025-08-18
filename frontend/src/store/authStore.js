import { create } from "zustand";
import axios from "axios";
import { handleError, handleSuccess } from "../utils/errorHandler.js";

const API_URL = import.meta.env.VITE_API_URL
	? `${import.meta.env.VITE_API_URL}/auth`
	: import.meta.env.MODE === "development"
		? "http://localhost:6203/api/auth"
		: "/api/auth";

// Debug logging
console.log('🔧 AUTH STORE DEBUG:');
console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('MODE:', import.meta.env.MODE);
console.log('Final API_URL:', API_URL);

// Configure axios defaults
axios.defaults.withCredentials = true;

// Add request interceptor to include auth token
axios.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem('auth-token');
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	}
);

// Add response interceptor to handle token refresh
axios.interceptors.response.use(
	(response) => response,
	async (error) => {
		if (error.response?.status === 401) {
			// Clear invalid token
			localStorage.removeItem('auth-token');
			delete axios.defaults.headers.common['Authorization'];
		}
		return Promise.reject(error);
	}
);

export const useAuthStore = create((set, get) => ({
	user: null,
	isAuthenticated: false,
	error: null,
	isLoading: false,
	isCheckingAuth: false,
	message: null,
	_isCheckingAuthInProgress: false, // Flag to prevent multiple simultaneous checks

	// Role-based routing helper
	getRoleBasedRoute: () => {
		const { user } = get();
		if (!user || !user.role) return '/dashboard';

		switch (user.role) {
			case 'admin':
				return '/dashboard/admin';
			case 'faculty':
				return '/dashboard/faculty';
			case 'security':
				return '/dashboard/security';
			default:
				return '/dashboard';
		}
	},

	// Check if user has required role
	hasRole: (requiredRole) => {
		const { user } = get();
		if (!user || !user.role) return false;

		// Admin has access to all roles
		if (user.role === 'admin') return true;

		// Check specific role
		return user.role === requiredRole;
	},

	// Check if user has any of the required roles
	hasAnyRole: (requiredRoles) => {
		const { user } = get();
		if (!user || !user.role) return false;

		// Admin has access to all roles
		if (user.role === 'admin') return true;

		// Check if user role is in required roles
		return requiredRoles.includes(user.role);
	},

	// Complete user registration after OAuth
	completeRegistration: async (registrationData) => {
		set({ isLoading: true, error: null });

		try {
			const response = await axios.post(`${API_URL}/complete-registration`, registrationData);

			set({
				user: response.data.user,
				isAuthenticated: true,
				isLoading: false,
				error: null
			});

			handleSuccess(response.data.message || "Registration completed successfully!");
			return response.data;
		} catch (error) {
			const errorMessage = handleError(error);
			set({ error: errorMessage, isLoading: false });
			throw error;
		}
	},

	// Check registration status
	checkRegistrationStatus: async () => {
		try {
			const response = await axios.get(`${API_URL}/registration-status`);
			return response.data;
		} catch (error) {
			console.error("Check registration status error:", error);
			throw error;
		}
	},

	logout: async () => {
		set({ isLoading: true, error: null });
		try {
			await axios.post(`${API_URL}/logout`);
			
			// Clear local storage
			localStorage.removeItem('auth-token');
			delete axios.defaults.headers.common['Authorization'];
			
			set({
				user: null,
				isAuthenticated: false,
				error: null,
				isLoading: false,
			});
			
			handleSuccess("Logged out successfully");
		} catch (error) {
			// Even if logout fails on server, clear local state
			localStorage.removeItem('auth-token');
			delete axios.defaults.headers.common['Authorization'];
			
			set({
				user: null,
				isAuthenticated: false,
				error: null,
				isLoading: false,
			});
		}
	},

	// Force reset auth state if stuck
	forceResetAuthState: () => {
		console.log('🔄 Force resetting auth state...');
		set({
			_isCheckingAuthInProgress: false,
			isCheckingAuth: false
		});
	},

	checkAuth: async () => {
		const { _isCheckingAuthInProgress, isCheckingAuth } = get();

		// Prevent multiple simultaneous auth checks - TEMPORARILY DISABLED FOR DEBUGGING
		// if (_isCheckingAuthInProgress || isCheckingAuth) {
		//	console.log('🚫 Auth check already in progress, skipping...');
		//	return;
		// }

		console.log('🔄 Starting auth check...');
		set({ isCheckingAuth: true, error: null, _isCheckingAuthInProgress: true });

		// Safety timeout to reset flag in case something goes wrong
		const timeoutId = setTimeout(() => {
			console.log('⏰ Auth check timeout, resetting flag...');
			set({ _isCheckingAuthInProgress: false, isCheckingAuth: false });
		}, 5000); // 5 second timeout

		try {
			console.log('=== FRONTEND CHECK AUTH ===');
			console.log('Making request to:', `${API_URL}/check-auth`);
			console.log('Axios withCredentials:', axios.defaults.withCredentials);
			console.log('Authorization header:', axios.defaults.headers.common['Authorization'] ? 'Set' : 'Not set');
			console.log('LocalStorage token:', localStorage.getItem('auth-token') ? 'Present' : 'Missing');

			// Ensure Authorization header is set if we have a token
			const token = localStorage.getItem('auth-token');
			if (token && !axios.defaults.headers.common['Authorization']) {
				axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
				console.log('🔑 Authorization header set from localStorage');
			}

			const response = await axios.get(`${API_URL}/check-auth`);

			console.log('Check auth successful:', response.data);
			console.log('===========================');

			clearTimeout(timeoutId);
			set({
				user: response.data.user,
				isAuthenticated: true,
				isCheckingAuth: false,
				error: null,
				_isCheckingAuthInProgress: false
			});
		} catch (error) {
			console.log('=== CHECK AUTH FAILED ===');
			console.log('Error:', error.response?.data || error.message);
			console.log('Status:', error.response?.status);
			console.log('=========================');

			// Clear invalid token
			localStorage.removeItem('auth-token');
			delete axios.defaults.headers.common['Authorization'];

			clearTimeout(timeoutId);
			// Don't show error toast for auth check failures
			set({
				user: null,
				isAuthenticated: false,
				isCheckingAuth: false,
				error: null,
				_isCheckingAuthInProgress: false
			});
		}
	},

	// Clear error
	clearError: () => set({ error: null }),

	// Clear message
	clearMessage: () => set({ message: null }),

	// Update user profile
	updateProfile: async (profileData) => {
		set({ isLoading: true, error: null });

		try {
			const response = await axios.put(`${API_URL}/update-profile`, profileData);

			set({
				user: response.data.user,
				isLoading: false,
				error: null
			});

			handleSuccess(response.data.message || "Profile updated successfully!");
			return response.data;
		} catch (error) {
			const errorMessage = handleError(error);
			set({ error: errorMessage, isLoading: false });
			throw error;
		}
	},
}));
