
# Minimum CMake version
cmake_minimum_required(VERSION 3.10.2)

# Set project name
project(stfugameguardian C CXX)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Include Android log library and other needed libraries
find_library(log-lib log)
find_library(android-lib android)

# Add the native library
add_library(
        # Library name
        stfugameguardian
        
        # Library type - SHARED for dynamic library
        SHARED
        
        # Source files
        GameGuardianShield.cpp
)

# Add include directories
target_include_directories(stfugameguardian PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}
)

# Link libraries
target_link_libraries(
        stfugameguardian
        ${log-lib}
        ${android-lib}
)

# Enable position-independent code for shared library
set_target_properties(stfugameguardian PROPERTIES
        POSITION_INDEPENDENT_CODE ON
)

# Set compilation flags for security
target_compile_options(stfugameguardian PRIVATE
        -Wall
        -Werror
        -fvisibility=hidden
        -ffunction-sections
        -fdata-sections
        -fstack-protector-all
        -D_FORTIFY_SOURCE=2
        -fPIE
        -fno-rtti
        -fno-exceptions
)

# Set link flags
target_link_options(stfugameguardian PRIVATE
        -Wl,--gc-sections
        -Wl,-z,relro
        -Wl,-z,now
        -Wl,--exclude-libs,ALL
)

# Define preprocessor macros
target_compile_definitions(stfugameguardian PRIVATE
        ANDROID
        NDEBUG
)

# Output information during build
message(STATUS "Configuring STFUGameGuardian native library")
message(STATUS "Android ABI: ${ANDROID_ABI}")
message(STATUS "Android platform: ${ANDROID_PLATFORM}")
message(STATUS "C++ compiler: ${CMAKE_CXX_COMPILER}")
