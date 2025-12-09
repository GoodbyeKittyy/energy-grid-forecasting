"""
Energy Grid Load Forecasting with Beta Regression
Predicts renewable energy capacity factors using Beta distribution
Includes quantile regression for probabilistic forecasts
"""

import numpy as np
import pandas as pd
from scipy import stats
from scipy.optimize import minimize
from scipy.special import digamma, polygamma
import json
from datetime import datetime, timedelta


class BetaRegression:
    """Beta Regression for bounded continuous outcomes (0, 1)"""
    
    def __init__(self, link='logit'):
        self.link = link
        self.beta_mu = None
        self.beta_phi = None
        self.coefficients = None
        
    def _logit(self, x):
        return np.log(x / (1 - x))
    
    def _logit_inv(self, x):
        return 1 / (1 + np.exp(-x))
    
    def _beta_loglik(self, params, X, y):
        """Negative log-likelihood for beta distribution"""
        n_features = X.shape[1]
        beta = params[:n_features]
        phi = np.exp(params[n_features])
        
        mu = self._logit_inv(X @ beta)
        mu = np.clip(mu, 1e-6, 1 - 1e-6)
        
        alpha = mu * phi
        beta_param = (1 - mu) * phi
        
        loglik = np.sum(
            stats.beta.logpdf(y, alpha, beta_param)
        )
        
        return -loglik
    
    def fit(self, X, y):
        """Fit beta regression model"""
        y = np.clip(y, 1e-6, 1 - 1e-6)
        
        n_features = X.shape[1]
        init_params = np.concatenate([
            np.zeros(n_features),
            [1.0]
        ])
        
        result = minimize(
            self._beta_loglik,
            init_params,
            args=(X, y),
            method='BFGS',
            options={'maxiter': 1000}
        )
        
        self.coefficients = result.x[:n_features]
        self.beta_phi = np.exp(result.x[n_features])
        
        return self
    
    def predict(self, X):
        """Predict mean capacity factor"""
        linear_pred = X @ self.coefficients
        mu = self._logit_inv(linear_pred)
        return np.clip(mu, 0, 1)
    
    def predict_quantile(self, X, quantile=0.5):
        """Predict specific quantile"""
        mu = self.predict(X)
        alpha = mu * self.beta_phi
        beta_param = (1 - mu) * self.beta_phi
        
        quantiles = stats.beta.ppf(quantile, alpha, beta_param)
        return np.clip(quantiles, 0, 1)


class FourierFeatures:
    """Generate Fourier features for seasonality modeling"""
    
    def __init__(self, order=6, period=24):
        self.order = order
        self.period = period
    
    def transform(self, t):
        """
        t: array of time indices (hour of day)
        Returns: Fourier features matrix
        """
        features = []
        for k in range(1, self.order + 1):
            features.append(np.sin(2 * np.pi * k * t / self.period))
            features.append(np.cos(2 * np.pi * k * t / self.period))
        return np.column_stack(features)


class EnergyForecastingSystem:
    """Complete renewable energy forecasting system"""
    
    def __init__(self):
        self.solar_model = BetaRegression()
        self.wind_model = BetaRegression()
        self.fourier = FourierFeatures(order=6, period=24)
        self.fitted = False
        
    def generate_synthetic_data(self, n_days=90):
        """Generate synthetic training data"""
        hours = np.arange(n_days * 24)
        hour_of_day = hours % 24
        day_of_year = hours // 24
        
        # Solar capacity: high during day, zero at night
        solar_base = np.maximum(0, np.sin((hour_of_day - 6) * np.pi / 12))
        solar_seasonal = 0.2 * np.sin(2 * np.pi * day_of_year / 365)
        solar_noise = np.random.beta(2, 2, size=len(hours)) * 0.2
        solar = np.clip(solar_base * 0.8 + solar_seasonal + solar_noise, 0.01, 0.99)
        
        # Wind capacity: more variable, less diurnal pattern
        wind_base = 0.4 + 0.3 * np.sin(hour_of_day * np.pi / 6)
        wind_seasonal = 0.15 * np.cos(2 * np.pi * day_of_year / 365)
        wind_noise = np.random.beta(2, 2, size=len(hours)) * 0.3
        wind = np.clip(wind_base + wind_seasonal + wind_noise, 0.01, 0.99)
        
        # Weather features (temperature, cloud cover, wind speed)
        temperature = 20 + 10 * np.sin(2 * np.pi * day_of_year / 365) + np.random.randn(len(hours)) * 3
        cloud_cover = np.random.beta(2, 5, size=len(hours))
        wind_speed = 5 + 3 * np.sin(2 * np.pi * day_of_year / 365) + np.random.gamma(2, 2, size=len(hours))
        
        df = pd.DataFrame({
            'hour_of_day': hour_of_day,
            'day_of_year': day_of_year,
            'temperature': temperature,
            'cloud_cover': cloud_cover,
            'wind_speed': wind_speed,
            'solar_capacity': solar,
            'wind_capacity': wind
        })
        
        return df
    
    def prepare_features(self, df):
        """Prepare feature matrix with Fourier features"""
        fourier_features = self.fourier.transform(df['hour_of_day'].values)
        
        X = np.column_stack([
            np.ones(len(df)),  # Intercept
            fourier_features,
            df['temperature'].values / 100,
            df['cloud_cover'].values,
            df['wind_speed'].values / 10,
            np.sin(2 * np.pi * df['day_of_year'].values / 365),
            np.cos(2 * np.pi * df['day_of_year'].values / 365)
        ])
        
        return X
    
    def train(self, df):
        """Train both solar and wind models"""
        X = self.prepare_features(df)
        
        self.solar_model.fit(X, df['solar_capacity'].values)
        self.wind_model.fit(X, df['wind_capacity'].values)
        
        self.fitted = True
        print("Models trained successfully")
        
    def forecast_24h(self, start_hour=0, start_day=0):
        """Generate 24-hour forecast with quantiles"""
        hours = np.arange(24)
        hour_of_day = (start_hour + hours) % 24
        day_of_year = np.full(24, start_day)
        
        # Simulated weather forecast
        temperature = 20 + 5 * np.sin(2 * np.pi * day_of_year / 365) + np.random.randn(24) * 2
        cloud_cover = np.clip(0.3 + np.random.randn(24) * 0.15, 0, 1)
        wind_speed = 6 + 2 * np.sin(2 * np.pi * day_of_year / 365) + np.random.gamma(2, 1.5, size=24)
        
        forecast_df = pd.DataFrame({
            'hour_of_day': hour_of_day,
            'day_of_year': day_of_year,
            'temperature': temperature,
            'cloud_cover': cloud_cover,
            'wind_speed': wind_speed
        })
        
        X = self.prepare_features(forecast_df)
        
        # Point forecasts
        solar_p50 = self.solar_model.predict(X)
        wind_p50 = self.wind_model.predict(X)
        
        # Quantile forecasts
        solar_p10 = self.solar_model.predict_quantile(X, 0.1)
        solar_p90 = self.solar_model.predict_quantile(X, 0.9)
        wind_p10 = self.wind_model.predict_quantile(X, 0.1)
        wind_p90 = self.wind_model.predict_quantile(X, 0.9)
        
        forecast = {
            'timestamp': [(datetime.now() + timedelta(hours=int(h))).strftime('%Y-%m-%d %H:%M:%S') for h in hours],
            'hour': hour_of_day.tolist(),
            'solar': {
                'p10': solar_p10.tolist(),
                'p50': solar_p50.tolist(),
                'p90': solar_p90.tolist()
            },
            'wind': {
                'p10': wind_p10.tolist(),
                'p50': wind_p50.tolist(),
                'p90': wind_p90.tolist()
            }
        }
        
        return forecast
    
    def recommend_action(self, solar_forecast, wind_forecast, demand, battery_level):
        """Recommend grid management actions"""
        total_renewable = solar_forecast + wind_forecast
        
        if total_renewable < demand * 0.85:
            if battery_level > 0.3:
                return "DISCHARGE_BATTERY"
            else:
                return "ACTIVATE_BACKUP"
        elif total_renewable > demand * 1.15:
            if battery_level < 0.9:
                return "CHARGE_BATTERY"
            else:
                return "CURTAIL_GENERATION"
        else:
            return "NOMINAL_OPERATION"


def main():
    """Main execution function"""
    print("=" * 60)
    print("ENERGY GRID LOAD FORECASTING SYSTEM")
    print("Beta Regression with Quantile Forecasts")
    print("=" * 60)
    
    # Initialize system
    system = EnergyForecastingSystem()
    
    # Generate and train on synthetic data
    print("\n[1] Generating synthetic historical data...")
    training_data = system.generate_synthetic_data(n_days=90)
    print(f"Generated {len(training_data)} hours of data")
    
    # Train models
    print("\n[2] Training beta regression models...")
    system.train(training_data)
    
    # Generate 24-hour forecast
    print("\n[3] Generating 24-hour probabilistic forecast...")
    current_hour = datetime.now().hour
    current_day = datetime.now().timetuple().tm_yday
    forecast = system.forecast_24h(start_hour=current_hour, start_day=current_day)
    
    # Display forecast summary
    print("\n[4] FORECAST SUMMARY (Next 6 Hours)")
    print("-" * 60)
    print(f"{'Hour':<10} {'Solar P50':<12} {'Wind P50':<12} {'Total':<10}")
    print("-" * 60)
    
    for i in range(6):
        solar = forecast['solar']['p50'][i]
        wind = forecast['wind']['p50'][i]
        total = solar + wind
        print(f"{forecast['hour'][i]:02d}:00     {solar:.3f}        {wind:.3f}        {total:.3f}")
    
    # Save forecast to JSON
    print("\n[5] Saving forecast to forecast_output.json...")
    with open('forecast_output.json', 'w') as f:
        json.dump(forecast, f, indent=2)
    
    # Grid recommendations
    print("\n[6] GRID MANAGEMENT RECOMMENDATIONS")
    print("-" * 60)
    
    demand = 0.65  # Example current demand
    battery = 0.75  # Example battery level
    
    for i in range(0, 24, 6):
        solar = forecast['solar']['p50'][i]
        wind = forecast['wind']['p50'][i]
        action = system.recommend_action(solar, wind, demand, battery)
        print(f"Hour {forecast['hour'][i]:02d}:00 - {action}")
    
    print("\n" + "=" * 60)
    print("FORECAST COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()