# State Login Credentials

All states use the same password for authentication.

## Password (CASE-SENSITIVE)
```
ccai2026
```

**Important:** The password must be entered in lowercase exactly as shown above.

## Available State Keys

When logging in, select your state from the dropdown. The system uses these state keys:

| State Name | State Key |
|------------|-----------|
| Arizona (Maricopa County) | `az` |
| California (SF MTC) | `ca` |
| Colorado DOT | `co` |
| Federal Highway Administration | `fhwa` |
| Florida DOT | `fl` |
| Illinois Tollway | `il` |
| Indiana DOT | `in` |
| Indiana | `indiana` |
| Iowa DOT | `ia` |
| Iowa | `iowa` |
| Kansas DOT | `ks` |
| Kansas | `kansas` |
| Maryland DOT | `md` |
| Massachusetts DOT | `ma` |
| Minnesota DOT | `mn` |
| Minnesota | `minnesota` |
| Missouri DOT | `mo` |
| Nebraska | `nebraska` |
| Nevada | `nevada` |
| New Jersey | `newjersey` |
| New Jersey Institute of Technology | `nj` |
| New York DOT | `ny` |
| North Carolina DOT | `nc` |
| Ohio DOT | `ohio` |
| Oklahoma DOT | `ok` |
| Pennsylvania Turnpike | `pa` |
| Texas DOT | `tx` |
| Utah | `utah` |
| Utah DOT | `ut` |
| Virginia DOT | `va` |
| Washington State DOT | `wa` |
| Wisconsin DOT | `wi` |

## Testing Login

You can test login with curl:
```bash
curl -X POST http://localhost:3001/api/states/login \
  -H "Content-Type: application/json" \
  -d '{"stateKey":"ohio","password":"ccai2026"}'
```

## Common Issues

1. **Invalid Password Error**
   - Make sure you're using lowercase: `ccai2026` (NOT `CCAI2026`)
   - Check for extra spaces before or after the password

2. **State Not Found**
   - Verify you selected a state from the dropdown
   - State keys are case-sensitive and should match the table above
