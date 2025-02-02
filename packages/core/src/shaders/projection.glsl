#define TILE_SIZE 512.0
#define PI 3.1415926536
#define WORLD_SCALE TILE_SIZE / (PI * 2.0)

#define COORDINATE_SYSTEM_LNGLAT 1.0
#define COORDINATE_SYSTEM_LNGLAT_OFFSET 2.0
#define COORDINATE_SYSTEM_VECTOR_TILE 3.0
#define COORDINATE_SYSTEM_IDENTITY 4.0
#define COORDINATE_SYSTEM_METER_OFFSET 5.0

uniform mat4 u_ViewMatrix;
uniform mat4 u_ProjectionMatrix;
uniform mat4 u_ViewProjectionMatrix;
uniform float u_Zoom : 1;
uniform float u_ZoomScale : 1;

uniform float u_CoordinateSystem;
uniform vec2 u_ViewportCenter;
uniform vec4 u_ViewportCenterProjection;
uniform vec3 u_PixelsPerDegree;
uniform vec3 u_PixelsPerDegree2;
uniform vec3 u_PixelsPerMeter;

// 经纬度 -> [0, 1]
vec2 project_mercator(vec2 lnglat) {
  float x = lnglat.x;
  return vec2(
    radians(x) + PI,
    PI - log(tan(PI * 0.25 + radians(lnglat.y) * 0.5))
  );
}

float project_scale(float meters) {
  return meters * u_PixelsPerMeter.z;
}

vec4 project_offset(vec4 offset) {
  float dy = offset.y;
  dy = clamp(dy, -1., 1.);
  vec3 pixels_per_unit = u_PixelsPerDegree + u_PixelsPerDegree2 * dy;
  return vec4(offset.xyz * pixels_per_unit, offset.w);
}

vec4 project_position(vec4 position) {
  if (u_CoordinateSystem == COORDINATE_SYSTEM_LNGLAT_OFFSET) {
    float X = position.x - u_ViewportCenter.x;
    float Y = position.y - u_ViewportCenter.y;
    return project_offset(vec4(X, Y, position.z, position.w));
  }

  if (u_CoordinateSystem == COORDINATE_SYSTEM_LNGLAT) {
    return vec4(
      project_mercator(position.xy) * WORLD_SCALE * u_ZoomScale,
      project_scale(position.z),
      position.w
    );
  }

  // TODO: 瓦片坐标系 & 常规世界坐标系
}

vec4 project_common_position_to_clipspace(vec4 position, mat4 viewProjectionMatrix, vec4 center) {
  if (u_CoordinateSystem == COORDINATE_SYSTEM_METER_OFFSET ||
    u_CoordinateSystem == COORDINATE_SYSTEM_LNGLAT_OFFSET) {
    // Needs to be divided with project_uCommonUnitsPerMeter
    position.w *= u_PixelsPerMeter.z;
  }
  return viewProjectionMatrix * position + center;
}

// Projects from common space coordinates to clip space
vec4 project_common_position_to_clipspace(vec4 position) {
  return project_common_position_to_clipspace(
    position,
    u_ViewProjectionMatrix,
    u_ViewportCenterProjection
  );
}