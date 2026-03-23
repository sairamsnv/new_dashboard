import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from dashboard.tasks.fetch_and_store import fetch_and_store_data

scheduler = BackgroundScheduler()

def fetch_wms_then_dr():
    """
    Fetch WMS data first, then trigger DR dashboard data fetching.
    """
    try:
        # First fetch WMS data
        logging.info("Starting WMS data fetch...")
        fetch_and_store_data()  # WMS function doesn't return True/False, it just completes
        
        # WMS data fetch completed (no exception means success)
        logging.info("WMS data fetch completed successfully. Now triggering DR dashboard data fetch...")
        
        # Then fetch DR dashboard data
        try:
            from dr_dashboard.tasks.fetch_and_store import fetch_and_store_dr_data
            dr_result = fetch_and_store_dr_data()
            
            if dr_result:
                logging.info("DR dashboard data fetch completed successfully.")
            else:
                logging.error("DR dashboard data fetch failed.")
                
        except ImportError:
            logging.warning("DR Dashboard tasks not available, skipping DR data fetching.")
        except Exception as e:
            logging.error(f"Error fetching DR dashboard data: {str(e)}")
            
    except Exception as e:
        logging.error(f"Error in WMS data fetch: {str(e)}")
        logging.error("WMS data fetch failed, skipping DR dashboard data fetch.")

def start_scheduler():
    if not scheduler.get_jobs():
        logging.info("Starting APScheduler job for WMS then DR data fetch every 5 mins.")
        scheduler.add_job(
            fetch_wms_then_dr,
            trigger=IntervalTrigger(minutes=5),
            id="fetch_wms_then_dr_job",
            name="Fetch WMS data then trigger DR dashboard data every 5 mins",
            replace_existing=True,
        )
        scheduler.start()

