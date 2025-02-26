import geoip2.database
import logging
from fastapi import Request
from pathlib import Path

logger = logging.getLogger(__name__)

DB_PATH = "./geodb/geolite2_country.mmdb"

BRAVE_REGIONS = {
    'AR', 'AU', 'AT', 'BE', 'BR', 'CA', 'CL', 'DK', 'FI', 'FR', 
    'DE', 'HK', 'IN', 'ID', 'IT', 'JP', 'KR', 'MY', 'MX', 'NL', 
    'NZ', 'NO', 'CN', 'PL', 'PT', 'PH', 'RU', 'SA', 'ZA', 'ES', 
    'SE', 'CH', 'TW', 'TR', 'GB', 'US'
}

def get_brave_region(iso_code: str | None) -> str:
    """Convert ISO country code to Brave API region code"""
    if not iso_code or iso_code.upper() not in BRAVE_REGIONS:
        return 'ALL'
    return iso_code.upper()

def get_country_from_request(request: Request, test_ip: str = None, db_path: Path = DB_PATH) -> str | None:
    """
    Helper function to get country code from a request or test IP.
    
    Args:
        request: FastAPI Request object containing client information
        test_ip: Optional IP address to use instead of request's client IP
        db_path: Path to the GeoLite2 database file
        
    Returns:
        Country code (ISO 3166-1 alpha-2) as string, or None if lookup fails
    """
    # Determine IP address
    if test_ip:
        client_ip = test_ip
    else:
        client_ip = request.client.host
        
        # Handle local development
        if client_ip == "127.0.0.1":
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                client_ip = forwarded_for.split(",")[0].strip()
            else:
                # Use a sample IP for local testing
                client_ip = "8.8.8.8"

    try:
        # Open GeoIP2 database
        with geoip2.database.Reader(db_path) as reader:
            response = reader.country(client_ip)
            return get_brave_region(response.country.iso_code)
            
    except geoip2.errors.AddressNotFoundError:
        logger.error(f"Could not determine country from IP: {client_ip}")
        return None
    except Exception as e:
        logger.error(f"Error occurred while processing IP {client_ip}: {str(e)}")
        return None