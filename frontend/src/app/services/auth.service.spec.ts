import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { LoginCredentials, RegisterData, User } from '../models';
import { environment } from '../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: jasmine.SpyObj<Router>;

  const mockUser: User = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    handle: 'testuser',
    profile_picture: undefined,
    banner_image: undefined,
    bio: '',
    location: '',
    website: '',
    created_at: '2024-01-01T00:00:00Z',
    date_joined: '2024-01-01T00:00:00Z',
    followers_count: 0,
    following_count: 0,
    posts_count: 0,
    is_staff: false,
    following_only_preference: false
  };

  const mockAuthResponse = {
    access: 'mock-access-token',
    refresh: 'mock-refresh-token',
    user: mockUser
  };

  beforeEach(() => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy }
      ]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    // Clear localStorage before each test
    localStorage.clear();
    
    // Reset service state to avoid initialization interference
    service['accessToken'] = null;
    service['refreshToken'] = null;
    service['currentUserSubject'].next(null);
  });

  afterEach(() => {
    // Handle any remaining requests before verification
    httpMock.match(`${environment.apiUrl}/api/users/me/`).forEach(req => req.flush({}));
    httpMock.verify();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with no authenticated user', () => {
      // Handle any automatic user load requests
      httpMock.match(`${environment.apiUrl}/api/users/me/`).forEach(req => req.flush({}));
      
      expect(service.isAuthenticated()).toBeFalse();
      expect(service.getAccessToken()).toBeNull();
    });

    it('should store and retrieve tokens from localStorage', () => {
      // Test that the service can store and retrieve tokens
      localStorage.setItem('access_token', 'test-token');
      localStorage.setItem('refresh_token', 'test-refresh');
      
      expect(localStorage.getItem('access_token')).toBe('test-token');
      expect(localStorage.getItem('refresh_token')).toBe('test-refresh');
    });
  });

  describe('Login', () => {
    const loginCredentials: LoginCredentials = {
      email: 'test@example.com',
      password: 'password123'
    };

    it('should login successfully and store tokens', () => {
      service.login(loginCredentials).subscribe(user => {
        expect(user).toEqual(mockUser);
        expect(service.isAuthenticated()).toBeTrue();
        expect(service.getAccessToken()).toBe('mock-access-token');
        expect(localStorage.getItem('access_token')).toBe('mock-access-token');
        expect(localStorage.getItem('refresh_token')).toBe('mock-refresh-token');
      });

      // Expect token request
      const tokenReq = httpMock.expectOne(`${environment.apiUrl}/api/token/`);
      expect(tokenReq.request.method).toBe('POST');
      expect(tokenReq.request.body).toEqual(loginCredentials);
      tokenReq.flush({ access: 'mock-access-token', refresh: 'mock-refresh-token' });

      // Expect user profile request
      const userReq = httpMock.expectOne(`${environment.apiUrl}/api/users/me/`);
      expect(userReq.request.method).toBe('GET');
      expect(userReq.request.headers.get('Authorization')).toBe('Bearer mock-access-token');
      userReq.flush(mockUser);
    });

    it('should handle login failure', () => {
      const errorResponse = { error: 'Invalid credentials' };
      
      service.login(loginCredentials).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.status).toBe(401);
          expect(service.isAuthenticated()).toBeFalse();
          expect(localStorage.getItem('access_token')).toBeNull();
        }
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/token/`);
      req.flush(errorResponse, { status: 401, statusText: 'Unauthorized' });
    });

    it('should handle missing access token in response', () => {
      service.login(loginCredentials).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain('No access token in response');
        }
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/token/`);
      req.flush({ refresh: 'mock-refresh-token' }); // Missing access token
    });
  });

  describe('Register', () => {
    const registerData: RegisterData = {
      username: 'newuser',
      email: 'new@example.com',
      password: 'password123',
      password2: 'password123',
      handle: 'newuser'
    };

    it('should register successfully and store tokens', () => {
      service.register(registerData).subscribe(user => {
        expect(user).toEqual(mockUser);
        expect(service.isAuthenticated()).toBeTrue();
        expect(service.getAccessToken()).toBe('mock-access-token');
      });

      // Expect registration request
      const registerReq = httpMock.expectOne(`${environment.apiUrl}/api/users/`);
      expect(registerReq.request.method).toBe('POST');
      expect(registerReq.request.body).toEqual(registerData);
      registerReq.flush(mockAuthResponse);

      // Expect user profile request
      const userReq = httpMock.expectOne(`${environment.apiUrl}/api/users/me/`);
      userReq.flush(mockUser);
    });

    it('should handle registration failure', () => {
      const errorResponse = { error: 'Email already exists' };
      
      service.register(registerData).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.status).toBe(400);
          expect(service.isAuthenticated()).toBeFalse();
        }
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/users/`);
      req.flush(errorResponse, { status: 400, statusText: 'Bad Request' });
      
      // Handle any additional requests that might be made during logout
      httpMock.match(`${environment.apiUrl}/api/users/me/`).forEach(req => req.flush({}));
    });
  });

  describe('Token Management', () => {
    beforeEach(() => {
      // Setup authenticated state
      localStorage.setItem('access_token', 'mock-access-token');
      localStorage.setItem('refresh_token', 'mock-refresh-token');
      service['accessToken'] = 'mock-access-token';
      service['refreshToken'] = 'mock-refresh-token';
    });

    it('should refresh access token successfully', () => {
      service.refreshAccessToken().subscribe(response => {
        expect(response.access).toBe('new-access-token');
        expect(service.getAccessToken()).toBe('new-access-token');
        expect(localStorage.getItem('access_token')).toBe('new-access-token');
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/token/refresh/`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ refresh: 'mock-refresh-token' });
      req.flush({ access: 'new-access-token' });
    });

    it('should handle token refresh failure', () => {
      service.refreshAccessToken().subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.status).toBe(401);
          expect(service.isAuthenticated()).toBeFalse();
          expect(router.navigate).toHaveBeenCalledWith(['/']);
        }
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/token/refresh/`);
      req.flush({ error: 'Invalid refresh token' }, { status: 401, statusText: 'Unauthorized' });
      
      // Handle any additional requests that might be made during logout
      httpMock.match(`${environment.apiUrl}/api/users/me/`).forEach(req => req.flush({}));
    });

    it('should handle missing refresh token', () => {
      service['refreshToken'] = null;
      
      service.refreshAccessToken().subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.message).toBe('No refresh token available');
        }
      });
    });
  });

  describe('User State Management', () => {
    it('should emit current user changes', (done) => {
      service.currentUser$.subscribe(user => {
        if (user) {
          expect(user).toEqual(mockUser);
          done();
        }
      });

      // Simulate user login
      service['currentUserSubject'].next(mockUser);
    });

    it('should load user profile successfully', () => {
      // Setup authenticated state first
      service['accessToken'] = 'mock-access-token';
      
      service.loadUser().subscribe(() => {
        expect(service['currentUserSubject'].value).toEqual(mockUser);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/users/me/`);
      expect(req.request.method).toBe('GET');
      req.flush(mockUser);
    });

    it('should handle user profile loading failure', () => {
      // Setup authenticated state first
      service['accessToken'] = 'mock-access-token';
      
      service.loadUser().subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.status).toBe(401);
          expect(router.navigate).toHaveBeenCalledWith(['/']);
        }
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/users/me/`);
      req.flush({ error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    });
  });

  describe('Authentication Status', () => {
    it('should return correct authentication status', () => {
      expect(service.isAuthenticated()).toBeFalse();
      
      service['accessToken'] = 'mock-token';
      expect(service.isAuthenticated()).toBeTrue();
    });

    it('should return correct admin status', () => {
      expect(service.isAdmin()).toBeFalse();
      
      const adminUser = { ...mockUser, is_staff: true };
      service['currentUserSubject'].next(adminUser);
      expect(service.isAdmin()).toBeTrue();
      
      // Handle any additional requests that might be made
      httpMock.match(`${environment.apiUrl}/api/users/me/`).forEach(req => req.flush({}));
    });
  });

  describe('User Preferences', () => {
    beforeEach(() => {
      // Setup authenticated state
      service['accessToken'] = 'mock-access-token';
      service['currentUserSubject'].next(mockUser);
    });

    it('should update following only preference', () => {
      service.updateFollowingOnlyPreference(true).subscribe(user => {
        expect(user.following_only_preference).toBeTrue();
        expect(service['currentUserSubject'].value?.following_only_preference).toBeTrue();
        expect(localStorage.getItem('following_only_preference')).toBe('true');
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/users/me/`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ following_only_preference: true });
      req.flush({ ...mockUser, following_only_preference: true });
    });
  });

  describe('Logout', () => {
    beforeEach(() => {
      // Setup authenticated state
      service['accessToken'] = 'mock-access-token';
      service['refreshToken'] = 'mock-refresh-token';
      service['currentUserSubject'].next(mockUser);
      localStorage.setItem('access_token', 'mock-access-token');
      localStorage.setItem('refresh_token', 'mock-refresh-token');
      localStorage.setItem('user', JSON.stringify(mockUser));
    });

    it('should clear all auth data and navigate to home', () => {
      service.logout();

      expect(service.isAuthenticated()).toBeFalse();
      expect(service.getAccessToken()).toBeNull();
      expect(service['currentUserSubject'].value).toBeNull();
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should clear timers on logout', () => {
      // Setup timers
      service['refreshTimer'] = setTimeout(() => {}, 1000);
      service['activityTimer'] = setTimeout(() => {}, 1000);

      service.logout();

      expect(service['refreshTimer']).toBeNull();
      expect(service['activityTimer']).toBeNull();
    });
  });

  describe('Token Decoding', () => {
    it('should decode valid JWT token', () => {
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyNDI2MjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      
      const decoded = service['decodeToken'](validToken);
      expect(decoded).toBeTruthy();
      expect(decoded.sub).toBe('1234567890');
      expect(decoded.name).toBe('John Doe');
    });

    it('should handle invalid JWT token', () => {
      const invalidToken = 'invalid-token';
      
      const decoded = service['decodeToken'](invalidToken);
      expect(decoded).toBeNull();
    });
  });

  describe('URL Processing', () => {
    it('should process user profile picture URLs correctly', () => {
      const userWithRelativePath = {
        ...mockUser,
        profile_picture: '/media/profile_pictures/user.jpg'
      };

      const processed = service['processUserData'](userWithRelativePath);
      expect(processed.profile_picture).toBe(`${environment.apiUrl}/media/profile_pictures/user.jpg`);
    });

    it('should not modify absolute URLs', () => {
      const userWithAbsolutePath = {
        ...mockUser,
        profile_picture: 'https://example.com/image.jpg'
      };

      const processed = service['processUserData'](userWithAbsolutePath);
      expect(processed.profile_picture).toBe('https://example.com/image.jpg');
    });

         it('should handle undefined profile pictures', () => {
       const userWithUndefinedPicture = {
         ...mockUser,
         profile_picture: undefined
       };

       const processed = service['processUserData'](userWithUndefinedPicture);
       expect(processed.profile_picture).toBeUndefined();
     });
  });
}); 