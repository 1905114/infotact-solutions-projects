# Food Delivery Platform API Documentation

## Overview

**Base URL:** `https://api.foodplatform.com/v1`

**Version:** 2.0.0

**Authentication:** JWT Bearer Token

**Content-Type:** `application/json`

## Table of Contents

1. [Authentication](#authentication)
2. [Users](#users)
3. [Restaurants](#restaurants)
4. [Cart](#cart)
5. [Orders](#orders)
6. [Reviews](#reviews)
7. [Payments](#payments)
8. [Merchant Dashboard](#merchant-dashboard)
9. [Admin Dashboard](#admin-dashboard)
10. [WebSocket API](#websocket-api)
11. [Error Codes](#error-codes)

---

## Authentication

### Register User

Creates a new user account.

**Endpoint:** `POST /auth/register`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phoneNumber": "+1234567890",
  "password": "SecurePass123!",
  "role": "customer"
}