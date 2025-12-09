/**
 * Fourier Transform Implementation for Seasonality Analysis
 * C++ implementation for high-performance seasonal decomposition
 * Used to extract periodic patterns in renewable energy generation
 */

#include <iostream>
#include <vector>
#include <cmath>
#include <complex>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <algorithm>

using namespace std;

const double PI = 3.14159265358979323846;

class FourierTransform {
private:
    vector<complex<double>> data;
    int n;
    
public:
    FourierTransform(const vector<double>& input) {
        n = input.size();
        data.resize(n);
        for (int i = 0; i < n; i++) {
            data[i] = complex<double>(input[i], 0.0);
        }
    }
    
    // Cooley-Tukey FFT algorithm
    void fft(vector<complex<double>>& x) {
        int N = x.size();
        if (N <= 1) return;
        
        // Divide
        vector<complex<double>> even(N/2), odd(N/2);
        for (int i = 0; i < N/2; i++) {
            even[i] = x[i*2];
            odd[i] = x[i*2 + 1];
        }
        
        // Conquer
        fft(even);
        fft(odd);
        
        // Combine
        for (int k = 0; k < N/2; k++) {
            complex<double> t = polar(1.0, -2 * PI * k / N) * odd[k];
            x[k] = even[k] + t;
            x[k + N/2] = even[k] - t;
        }
    }
    
    // Inverse FFT
    void ifft(vector<complex<double>>& x) {
        int N = x.size();
        
        // Conjugate
        for (int i = 0; i < N; i++) {
            x[i] = conj(x[i]);
        }
        
        // Forward FFT
        fft(x);
        
        // Conjugate and scale
        for (int i = 0; i < N; i++) {
            x[i] = conj(x[i]) / complex<double>(N, 0);
        }
    }
    
    // Compute FFT and return frequencies and magnitudes
    void compute() {
        // Pad to nearest power of 2
        int padded_size = 1;
        while (padded_size < n) {
            padded_size *= 2;
        }
        
        vector<complex<double>> padded_data(padded_size);
        for (int i = 0; i < n; i++) {
            padded_data[i] = data[i];
        }
        for (int i = n; i < padded_size; i++) {
            padded_data[i] = complex<double>(0.0, 0.0);
        }
        
        fft(padded_data);
        data = padded_data;
    }
    
    // Get magnitude spectrum
    vector<double> getMagnitudeSpectrum() {
        vector<double> magnitude(data.size() / 2);
        for (size_t i = 0; i < magnitude.size(); i++) {
            magnitude[i] = abs(data[i]);
        }
        return magnitude;
    }
    
    // Get phase spectrum
    vector<double> getPhaseSpectrum() {
        vector<double> phase(data.size() / 2);
        for (size_t i = 0; i < phase.size(); i++) {
            phase[i] = arg(data[i]);
        }
        return phase;
    }
    
    // Extract dominant frequencies
    vector<pair<int, double>> getDominantFrequencies(int top_k = 5) {
        vector<double> magnitude = getMagnitudeSpectrum();
        vector<pair<int, double>> freq_mag;
        
        for (size_t i = 1; i < magnitude.size(); i++) {
            freq_mag.push_back(make_pair(i, magnitude[i]));
        }
        
        sort(freq_mag.begin(), freq_mag.end(), 
             [](const pair<int, double>& a, const pair<int, double>& b) {
                 return a.second > b.second;
             });
        
        vector<pair<int, double>> result;
        for (int i = 0; i < min(top_k, (int)freq_mag.size()); i++) {
            result.push_back(freq_mag[i]);
        }
        
        return result;
    }
};

class SeasonalDecomposition {
private:
    vector<double> original;
    vector<double> trend;
    vector<double> seasonal;
    vector<double> residual;
    int period;
    
public:
    SeasonalDecomposition(const vector<double>& data, int period_length) 
        : original(data), period(period_length) {
        trend.resize(data.size());
        seasonal.resize(data.size());
        residual.resize(data.size());
    }
    
    // Moving average for trend extraction
    void extractTrend() {
        int window = period;
        for (size_t i = 0; i < original.size(); i++) {
            double sum = 0.0;
            int count = 0;
            
            for (int j = -(window/2); j <= window/2; j++) {
                int idx = i + j;
                if (idx >= 0 && idx < (int)original.size()) {
                    sum += original[idx];
                    count++;
                }
            }
            
            trend[i] = sum / count;
        }
    }
    
    // Extract seasonal component using Fourier analysis
    void extractSeasonal() {
        vector<double> detrended(original.size());
        for (size_t i = 0; i < original.size(); i++) {
            detrended[i] = original[i] - trend[i];
        }
        
        // Use FFT to identify seasonal patterns
        FourierTransform ft(detrended);
        ft.compute();
        
        auto dominant = ft.getDominantFrequencies(3);
        
        // Reconstruct seasonal component from dominant frequencies
        for (size_t i = 0; i < seasonal.size(); i++) {
            seasonal[i] = 0.0;
            for (const auto& freq : dominant) {
                int k = freq.first;
                double magnitude = freq.second / seasonal.size();
                seasonal[i] += magnitude * cos(2 * PI * k * i / seasonal.size());
            }
        }
        
        // Normalize seasonal component
        double seasonal_mean = 0.0;
        for (double val : seasonal) {
            seasonal_mean += val;
        }
        seasonal_mean /= seasonal.size();
        
        for (double& val : seasonal) {
            val -= seasonal_mean;
        }
    }
    
    // Calculate residual
    void extractResidual() {
        for (size_t i = 0; i < original.size(); i++) {
            residual[i] = original[i] - trend[i] - seasonal[i];
        }
    }
    
    // Perform complete decomposition
    void decompose() {
        extractTrend();
        extractSeasonal();
        extractResidual();
    }
    
    // Getters
    const vector<double>& getTrend() const { return trend; }
    const vector<double>& getSeasonal() const { return seasonal; }
    const vector<double>& getResidual() const { return residual; }
    
    // Calculate seasonality strength
    double getSeasonalityStrength() const {
        double var_seasonal = 0.0, var_residual = 0.0;
        
        for (size_t i = 0; i < seasonal.size(); i++) {
            var_seasonal += seasonal[i] * seasonal[i];
            var_residual += residual[i] * residual[i];
        }
        
        var_seasonal /= seasonal.size();
        var_residual /= residual.size();
        
        return var_seasonal / (var_seasonal + var_residual);
    }
};

// Read CSV data
vector<double> readCSV(const string& filename, const string& column) {
    vector<double> data;
    ifstream file(filename);
    string line, header;
    
    if (!file.is_open()) {
        cerr << "Error: Cannot open file " << filename << endl;
        return data;
    }
    
    getline(file, header);
    vector<string> headers;
    stringstream ss(header);
    string token;
    
    while (getline(ss, token, ',')) {
        headers.push_back(token);
    }
    
    int col_idx = -1;
    for (size_t i = 0; i < headers.size(); i++) {
        if (headers[i] == column) {
            col_idx = i;
            break;
        }
    }
    
    if (col_idx == -1) {
        cerr << "Error: Column " << column << " not found" << endl;
        return data;
    }
    
    while (getline(file, line)) {
        stringstream line_ss(line);
        string value;
        int idx = 0;
        
        while (getline(line_ss, value, ',')) {
            if (idx == col_idx) {
                try {
                    data.push_back(stod(value));
                } catch (...) {
                    data.push_back(0.0);
                }
                break;
            }
            idx++;
        }
    }
    
    file.close();
    return data;
}

// Generate synthetic energy data
vector<double> generateSyntheticData(int n_hours) {
    vector<double> data(n_hours);
    
    for (int i = 0; i < n_hours; i++) {
        int hour = i % 24;
        int day = i / 24;
        
        // Solar-like pattern: high during day
        double solar_component = max(0.0, sin((hour - 6) * PI / 12)) * 0.6;
        
        // Seasonal component: varies over days
        double seasonal = 0.2 * sin(2 * PI * day / 365.0);
        
        // Random noise
        double noise = ((double)rand() / RAND_MAX - 0.5) * 0.1;
        
        data[i] = solar_component + seasonal + noise + 0.2;
    }
    
    return data;
}

int main() {
    cout << "========================================" << endl;
    cout << "FOURIER TRANSFORM SEASONAL ANALYSIS" << endl;
    cout << "Energy Generation Pattern Detection" << endl;
    cout << "========================================" << endl;
    
    // Generate synthetic hourly energy data for 90 days
    int n_hours = 90 * 24;
    vector<double> energy_data = generateSyntheticData(n_hours);
    
    cout << "\n[1] Generated " << n_hours << " hours of synthetic data" << endl;
    
    // Perform FFT analysis
    cout << "\n[2] Computing Fast Fourier Transform..." << endl;
    FourierTransform ft(energy_data);
    ft.compute();
    
    cout << "\n[3] Dominant Frequencies (Hz):" << endl;
    cout << "-----------------------------------" << endl;
    auto dominant = ft.getDominantFrequencies(5);
    
    for (size_t i = 0; i < dominant.size(); i++) {
        int freq_idx = dominant[i].first;
        double magnitude = dominant[i].second;
        double period_hours = (double)n_hours / freq_idx;
        
        cout << "Frequency " << i+1 << ": " << freq_idx 
             << " (Period: " << fixed << setprecision(1) << period_hours 
             << " hours, Magnitude: " << setprecision(2) << magnitude << ")" << endl;
    }
    
    // Seasonal decomposition
    cout << "\n[4] Performing Seasonal Decomposition..." << endl;
    SeasonalDecomposition decomp(energy_data, 24); // 24-hour period
    decomp.decompose();
    
    double seasonality_strength = decomp.getSeasonalityStrength();
    cout << "Seasonality Strength: " << fixed << setprecision(3) 
         << seasonality_strength * 100 << "%" << endl;
    
    // Export results
    cout << "\n[5] Exporting results to fourier_analysis.csv..." << endl;
    ofstream output("fourier_analysis.csv");
    
    output << "Hour,Original,Trend,Seasonal,Residual" << endl;
    
    const auto& trend = decomp.getTrend();
    const auto& seasonal = decomp.getSeasonal();
    const auto& residual = decomp.getResidual();
    
    int export_hours = min(168, n_hours); // Export first week
    for (int i = 0; i < export_hours; i++) {
        output << i << "," 
               << energy_data[i] << ","
               << trend[i] << ","
               << seasonal[i] << ","
               << residual[i] << endl;
    }
    
    output.close();
    
    cout << "\n========================================" << endl;
    cout << "ANALYSIS COMPLETE" << endl;
    cout << "========================================" << endl;
    
    return 0;
}